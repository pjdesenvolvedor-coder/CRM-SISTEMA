# **App Name**: ZapConnect

## Core Features:

- Connect Button: Initiates a POST request to the provided webhook to retrieve a QR code for WhatsApp pairing. The QR code is displayed as an image on the screen. Webhook URL: https://n8nbeta.typeflow.app.br/webhook/aeb30639-baf0-4862-9f5f-a3cc468ab7c5
- Status Monitoring: Sends a POST request to the specified webhook every 30 seconds to check the connection status of WhatsApp.  Webhook URL: https://n8nbeta.typeflow.app.br/webhook/ef3b141f-ebd0-433c-bdfc-2fb112558ffd
- Disconnect Button: Displays a 'Disconnect' button when the status is 'connecting' or 'connected'. Clicking it sends a POST request to disconnect. Webhook URL: https://n8nbeta.typeflow.app.br/webhook/2ac86d63-f7fc-4221-bbaf-efeecec33127
- Real-time Status Updates: Dynamically updates the interface to reflect the current WhatsApp connection status, changing the text or color of the card.

## Style Guidelines:

- Primary color: Soft blue (#A0CFEC) to create a calm and reliable feel, reflecting the app's function of maintaining stable communication.
- Background color: Light gray (#F0F4F7) provides a neutral backdrop that emphasizes content without distracting the user.
- Accent color: Muted violet (#B2A2C7) complements the primary blue and adds a touch of sophistication and modernity to the design.
- Body and headline font: 'Inter', a grotesque-style sans-serif, which conveys a neutral, machined look, making it great for displaying status information or buttons.  
- A card-based layout provides a clean and organized interface, making it easy for users to monitor the connection status and take actions.
- Use simple and clear icons to represent the connection status, making it easy for users to understand the current state of the WhatsApp connection at a glance.
- Subtle animations, like a smooth transition when the status updates, enhance the user experience without being intrusive.