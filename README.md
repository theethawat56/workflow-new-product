This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Line Bot Setup

1. Create a [Line Developers](https://developers.line.biz/en/) account and add a new channel for the Messaging API.
2. Under **Basic settings**, find and copy your `Channel secret`.
3. Under **Messaging API settings**, issue and copy a `Channel access token (long-lived)`.
4. Update your `.env` (or `.env.local`) with the following values:
   ```env
   LINE_CHANNEL_SECRET=your_channel_secret
   LINE_CHANNEL_ACCESS_TOKEN=your_access_token
   OPENAI_API_KEY=your_openai_api_key
   NEXT_PUBLIC_APP_URL=https://your-public-ngrok-or-domain.com
   ```
5. In your Line Developers Console -> **Messaging API settings**, set your **Webhook URL** to `https://your-public-ngrok-or-domain.com/api/line/webhook`.
6. Enable **Use webhook**.
7. Scan the **QR code** in the Messaging API settings to add your bot on Line, and start chatting to add products!
