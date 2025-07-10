# WhatsApp Bot Worker

This is the worker service for the WhatsApp bot that runs on Render.

## Files needed for worker:
- project.js
- settings.json
- auth_info_baileys/ (will be created automatically)

## How to deploy:
1. Create a new Worker service on Render
2. Connect your GitHub repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Deploy! 