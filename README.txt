Smart Lost & Found Refactored Frontend

Files:
- index.html: professional landing page
- auth.html: register, confirm, login page
- dashboard.html: authenticated app dashboard
- style.css: complete responsive styling
- app-refactored.js: Cognito + API Gateway + items logic

How to use:
1. Copy all files into your project folder.
2. Keep your old app.js as backup.
3. Open index.html with Live Server.
4. Register/Login from auth.html.
5. After login, you will be redirected to dashboard.html.

Important:
- app-refactored.js already uses your current Cognito User Pool ID and App Client ID.
- API URL is still https://de3iqs0cmf.execute-api.us-east-1.amazonaws.com.
- All API requests send Authorization: Bearer <idToken>.
