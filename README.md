# RizzPass

A secure, end-to-end encrypted password manager with passkey support.

## Features

- End-to-end encryption using Web Crypto API
- Passkey (WebAuthn) authentication
- Browser extension for autofill
- SQLite database
- Next.js app

## Installation

Clone the repo and install dependencies:

```bash
git clone https://github.com/AMEND09/RizzPass.git
cd RizzPass
npm install
```

## Running

### Local Development

```bash
npm run dev
```

### Using npx

To run directly with npx:

```bash
npx .
```

Or if published:

```bash
npx rizzpass
```

## Passkey Setup

1. Register with email/password or passkey.
2. For passkey login, click "Passkey" button and follow browser prompts.

## Security

- Passwords are encrypted client-side before sending to server.
- Passkeys provide passwordless authentication.
- Extension stores encrypted credentials.

## Deployment

Deploy to Vercel or similar. Set environment variables:
- `JWT_SECRET`
- `DATABASE_PATH=/tmp` (for Vercel)

## Browser Extension

Build and load the extension from `browser-extension/` folder.
