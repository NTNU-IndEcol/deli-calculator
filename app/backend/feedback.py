import requests
import os
import random
import string
from flask import Blueprint, request, jsonify, render_template, current_app # type: ignore 

feedback_bp = Blueprint('feedback', __name__)


def generate_verification_code(length=6):
    """Generate a random verification code (letters and numbers)"""
    chars = string.ascii_uppercase + string.digits
    # Remove similar looking characters to avoid confusion
    chars = chars.replace('O', '').replace('0', '').replace('I', '').replace('1', '').replace('S', '').replace('5', '')
    return ''.join(random.choice(chars) for _ in range(length))

def create_github_issue(name, user_email, issue_type, subject, message):
    """Create a GitHub issue from feedback form data"""
    
    # Get environment variables
    token = os.environ.get('GITHUB_TOKEN')
    repo_owner = os.environ.get('GITHUB_REPO_OWNER', 'NTNU-indecol')
    repo_name = os.environ.get('GITHUB_REPO_NAME', 'deli-calculator')
    
    if not token:
        current_app.logger.error("GITHUB_TOKEN environment variable is not set")
        return {
            'success': False,
            'error': 'GitHub token not configured'
        }
    
    # GitHub API URL
    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/issues"
    
    # Headers
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    # Create labels based on issue type
    labels = ["feedback"]
    if issue_type == "bug":
        labels.append("bug")
    elif issue_type == "feature":
        labels.append("enhancement")
    elif issue_type == "suggestion":
        labels.append("suggestion")
    else:
        labels.append("question")
    
    # Create issue body
    issue_body = f"""
## Feedback Details

**From:** {name}  
**Email:** {user_email}  
**Type:** {issue_type}  
**Subject:** {subject}

---

### Message:
{message}

---

*This issue was created automatically from the DELI Calculator feedback form.*
"""
    
    # Data payload
    data = {
        "title": f"Feedback: {subject}",
        "body": issue_body,
        "labels": labels
    }
    
    try:
        response = requests.post(url, json=data, headers=headers, timeout=30)
        
        if response.status_code == 201:
            issue_data = response.json()
            current_app.logger.info(f"Successfully created GitHub issue: {issue_data.get('html_url')}")
            return {
                'success': True,
                'issue_url': issue_data.get('html_url'),
                'issue_number': issue_data.get('number')
            }
        else:
            current_app.logger.error(f"GitHub API error: {response.status_code} - {response.text}")
            return {
                'success': False,
                'error': f"GitHub API returned status {response.status_code}: {response.text}"
            }
            
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Request error creating GitHub issue: {e}")
        return {
            'success': False,
            'error': f"Request failed: {str(e)}"
        }
    except Exception as e:
        current_app.logger.error(f"Unexpected error creating GitHub issue: {e}")
        return {
            'success': False,
            'error': f"Unexpected error: {str(e)}"
        }

@feedback_bp.route('/feedback', methods=['GET', 'POST'])
def feedback():
    if request.method == 'POST':
        # Get form data
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        issue_type = request.form.get('issue_type', 'other')
        subject = request.form.get('subject', '').strip()
        message = request.form.get('message', '').strip()
        human_input = request.form.get('human_input', '').strip()
        
        # Basic validation
        if not all([name, email, subject, message, human_input]):
            return jsonify({
                'success': False, 
                'message': 'Please fill in all required fields.'
            }), 400
        
        # Validate email format
        if '@' not in email:
            return jsonify({
                'success': False,
                'message': 'Please enter a valid email address.'
            }), 400
        
        try:
            # Create GitHub issue
            result = create_github_issue(name, email, issue_type, subject, message)
            
            # Now result is always a dictionary, so we can safely use .get()
            if result.get('success'):
                response_data = {
                    'success': True,
                    'message': 'Thank you for your feedback! We have received it and will review it soon.'
                }
                # Include issue URL if available (for debugging)
                if result.get('issue_url'):
                    response_data['issue_url'] = result.get('issue_url')
                    current_app.logger.info(f"Created GitHub issue: {result.get('issue_url')}")
                
                return jsonify(response_data)
            else:
                error_msg = result.get('error', 'Unknown error occurred')
                current_app.logger.error(f"Failed to create GitHub issue: {error_msg}")
                return jsonify({
                    'success': False, 
                    'message': 'Sorry, we encountered an error while submitting your feedback. Please try again later.'
                }), 500
                
        except Exception as e:
            current_app.logger.error(f"Unexpected error in feedback route: {e}")
            return jsonify({
                'success': False, 
                'message': 'An unexpected error occurred. Please try again later.'
            }), 500
    
    # GET request - render the form
    return render_template('feedback.html')