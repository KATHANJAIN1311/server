const generateRegistrationConfirmationEmail = (registrationData, eventData, qrCodeDataURL) => {
  const { registrationId, name, email, phoneNumber, organization, designation } = registrationData;
  const { name: eventName, date, time, venue } = eventData || {};

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registration Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); padding: 40px 30px; text-align: center;">
            <img src="https://creativeeraevents.com/assets/frontend-assets/images/1.site-logo.png" 
                 alt="Creative Era Events" 
                 style="width: 60px; height: 45px; background: #000; padding: 8px; border-radius: 12px; margin-bottom: 20px;">
            <h1 style="color: #000; margin: 0; font-size: 28px; font-weight: 700;">Welcome to Creative Era Events!</h1>
            <p style="color: #374151; margin: 10px 0 0 0; font-size: 16px;">Your registration is confirmed</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px 30px;">
            
            <!-- Welcome Message -->
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 24px; font-weight: 600;">Hello ${name}! 🎉</h2>
                <p style="color: #6b7280; margin: 0; font-size: 16px; line-height: 1.6;">
                    Thank you for registering with us. We're excited to have you join our event and look forward to providing you with an amazing experience.
                </p>
            </div>

            <!-- Registration Details -->
            <div style="background-color: #f9fafb; border-radius: 12px; padding: 25px; margin-bottom: 30px; border-left: 4px solid #fbbf24;">
                <h3 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">📋 Registration Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500; width: 40%;">Registration ID:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${registrationId}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Name:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Email:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Phone:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${phoneNumber}</td>
                    </tr>
                    ${organization ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Organization:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${organization}</td>
                    </tr>
                    ` : ''}
                    ${designation ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Designation:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${designation}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>

            ${eventName ? `
            <!-- Event Details -->
            <div style="background-color: #fef3c7; border-radius: 12px; padding: 25px; margin-bottom: 30px; border-left: 4px solid #f59e0b;">
                <h3 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">🎪 Event Information</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500; width: 40%;">Event Name:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${eventName}</td>
                    </tr>
                    ${date ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Date:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                    </tr>
                    ` : ''}
                    ${time ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Time:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${time}</td>
                    </tr>
                    ` : ''}
                    ${venue ? `
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Venue:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${venue}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
            ` : ''}

            <!-- QR Code Section -->
            <div style="text-align: center; background-color: #f3f4f6; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
                <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📱 Your Entry QR Code</h3>
                <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px;">Present this QR code at the event for quick check-in</p>
                <div style="display: inline-block; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    <img src="${qrCodeDataURL}" alt="QR Code" style="width: 200px; height: 200px; display: block;">
                </div>
            </div>

            <!-- Call to Action -->
            <div style="text-align: center; margin-bottom: 30px;">
                <a href="https://creativeeraevents.com/events" 
                   style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #000; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); transition: all 0.3s ease;">
                    Get Started 🚀
                </a>
            </div>

            <!-- Important Notes -->
            <div style="background-color: #eff6ff; border-radius: 12px; padding: 25px; margin-bottom: 30px; border-left: 4px solid #3b82f6;">
                <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">📌 Important Notes</h3>
                <ul style="color: #6b7280; margin: 0; padding-left: 20px; line-height: 1.6;">
                    <li>Save this email for event check-in</li>
                    <li>Arrive 15 minutes early for smooth entry</li>
                    <li>Bring a valid ID along with your QR code</li>
                    <li>Contact support if you have any questions</li>
                </ul>
            </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #1f2937; padding: 30px; text-align: center;">
            <div style="margin-bottom: 20px;">
                <img src="https://creativeeraevents.com/assets/frontend-assets/images/1.site-logo.png" 
                     alt="Creative Era Events" 
                     style="width: 40px; height: 30px; background: #000; padding: 6px; border-radius: 8px;">
            </div>
            
            <h4 style="color: #fbbf24; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Need Help?</h4>
            <p style="color: #d1d5db; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6;">
                Our support team is here to help you with any questions or concerns.
            </p>
            
            <div style="margin-bottom: 20px;">
                <a href="mailto:creativeeraevents@gmail.com" 
                   style="color: #fbbf24; text-decoration: none; font-weight: 500; margin: 0 15px;">
                    📧 creativeeraevents@gmail.com
                </a>
                <a href="tel:+919098176171" 
                   style="color: #fbbf24; text-decoration: none; font-weight: 500; margin: 0 15px;">
                    📞 +91 90981 76171
                </a>
            </div>
            
            <div style="border-top: 1px solid #374151; padding-top: 20px;">
                <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                    © 2024 Creative Era Events. All rights reserved.<br>
                    Office No. 308, NRK BIZPARK, PU 4, AB Road, INDORE (M.P.) 452010
                </p>
            </div>
        </div>
        
    </div>
</body>
</html>
  `;
};

module.exports = { generateRegistrationConfirmationEmail };