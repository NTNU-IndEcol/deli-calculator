# backend/feedback.py
import os
import datetime
import requests
import subprocess
from flask import Blueprint, request, jsonify, current_app # type: ignore

feedback_bp = Blueprint('feedback', __name__)

def verify_turnstile(token):
    """Verify Cloudflare Turnstile token"""
    if not token:
        return False
        
    data = {
        'secret': current_app.config.get('TURNSTILE_SECRET'),
        'response': token
    }
    
    try:
        response = requests.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            data=data,
            timeout=10
        )
        result = response.json()
        current_app.logger.info(f"Turnstile verification result: {result}")
        return result.get('success', False)
    except requests.RequestException as e:
        current_app.logger.error(f"Turnstile verification failed: {e}")
        return False

def send_feedback_email(form_data):
    """Send feedback email using system's sendmail command"""
    try:
        # Create email content
        subject = f"Feedback from Deli Calculator: {form_data['subject']}"
        
        email_body = f"""From: Deli Calculator <noreply@deli-calculator.indecol.no>
To: bo.huang@ntnu.no
Subject: {subject}
Content-Type: text/html; charset=utf-8

<html>
<body>
    <h2>New Feedback Received</h2>
    <p><strong>Name:</strong> {form_data['name']}</p>
    <p><strong>Email:</strong> {form_data['email']}</p>
    <p><strong>Issue Type:</strong> {form_data['issue_type']}</p>
    <p><strong>Subject:</strong> {form_data['subject']}</p>
    <p><strong>Message:</strong></p>
    <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #007cba;">
        {form_data['message'].replace(chr(10), '<br>')}
    </div>
    <hr>
    <p><small>Sent from deli-calculator.indecol.no</small></p>
</body>
</html>
"""
        
        # Use system's sendmail command
        process = subprocess.Popen(
            ['/usr/sbin/sendmail', '-t'], 
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Send the email
        stdout, stderr = process.communicate(input=email_body)
        
        # Check if sendmail was successful
        if process.returncode == 0:
            current_app.logger.info("Feedback email sent successfully via sendmail")
            return True
        else:
            current_app.logger.error(f"Sendmail failed with return code: {process.returncode}, stderr: {stderr}")
            return False
            
    except Exception as e:
        current_app.logger.error(f"Failed to send email: {e}")
        return False

def log_feedback(form_data):
    """Log feedback to a file"""
    try:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"""
        [{timestamp}] NEW FEEDBACK:
        Name: {form_data['name']}
        Email: {form_data['email']}
        Issue Type: {form_data['issue_type']}
        Subject: {form_data['subject']}
        Message: {form_data['message']}
        {'='*50}
        """
        log_file = "feedback_log.txt"
        with open(log_file, "a", encoding='utf-8') as f:
            f.write(log_entry)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to log feedback: {e}")
        return False

@feedback_bp.route('/submit_feedback', methods=['POST'])
def submit_feedback():
    try:
        # Verify Turnstile token first
        turnstile_token = request.form.get('cf-turnstile-response')
        current_app.logger.info(f"Received Turnstile token: {turnstile_token}")
        
        if not turnstile_token:
            return jsonify({'success': False, 'message': 'Human verification required. Please complete the challenge.'}), 400
            
        if not verify_turnstile(turnstile_token):
            return jsonify({'success': False, 'message': 'Human verification failed. Please try again.'}), 400

        # Collect form data
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        subject = request.form.get('subject', '').strip()
        message = request.form.get('message', '').strip()
        issue_type = request.form.get('issue_type', 'general')

        # Basic validation
        if not all([name, email, subject, message]):
            return jsonify({'success': False, 'message': 'All fields are required'}), 400
        if '@' not in email or '.' not in email:
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400

        form_data = {
            'name': name,
            'email': email,
            'subject': subject,
            'message': message,
            'issue_type': issue_type
        }

        # Send email using system sendmail
        if not send_feedback_email(form_data):
            return jsonify({'success': False, 'message': 'Error sending email. Please try again later.'}), 500

        # Log feedback
        log_feedback(form_data)

        current_app.logger.info(f"Feedback received and email sent for {name}")
        return jsonify({'success': True, 'message': 'Thank you for your feedback!'})

    except Exception as e:
        current_app.logger.error(f"Error processing feedback: {e}")
        return jsonify({'success': False, 'message': 'Error processing your message. Please try again.'}), 500