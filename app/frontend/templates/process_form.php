<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect and sanitize input
    $name = htmlspecialchars(trim($_POST['name']));
    $email = htmlspecialchars(trim($_POST['email']));
    $subject = htmlspecialchars(trim($_POST['subject']));
    $message = htmlspecialchars(trim($_POST['message']));

    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo "Invalid email format.";
        exit;
    }

    // Email details
    $to = "bo.huang@ntnu.no";//"contact@bamboo-horizon.eu"; // Replace with your email address
    $headers = "From: " . $name . " <" . $email . ">\r\n";
    $headers .= "Reply-To: " . $email . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=ISO-8859-1\r\n";

    // Compose email body
    $email_body = "<h2>Contact Form Submission</h2>";
    $email_body .= "<p><strong>Name:</strong> {$name}</p>";
    $email_body .= "<p><strong>Email:</strong> {$email}</p>";
    $email_body .= "<p><strong>Subject:</strong> {$subject}</p>";
    $email_body .= "<p><strong>Message:</strong><br>{$message}</p>";

    // Send email
    if (mail($to, $subject, $email_body, $headers)) {
        echo "Thank you for your message. We will get back to you shortly.";
    } else {
        echo "Sorry, there was an error sending your message. Please try again later.";
    }
} else {
    echo "Invalid request method.";
}

//redirect
header("Location:index.html");
?>
