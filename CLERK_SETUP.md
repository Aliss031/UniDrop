# Clerk Authentication Setup Guide

This application now uses Clerk for authentication instead of Firebase Auth. Follow these steps to set up Clerk:

## 1. Create a Clerk Account

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Sign up for a free account (or sign in if you already have one)
3. Create a new application

## 2. Get Your API Keys

1. In your Clerk Dashboard, go to **API Keys**
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

## 3. Set Up Environment Variables

Create a `.env.local` file in the root of your project with the following:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

**Important:** 
- Never commit `.env.local` to version control (it's already in `.gitignore`)
- Use test keys (`pk_test_` and `sk_test_`) for development
- Use live keys (`pk_live_` and `sk_live_`) for production

## 4. Configure Clerk Application Settings

In your Clerk Dashboard:

1. Go to **User & Authentication** → **Email, Phone, Username**
2. Enable the authentication methods you want (Email is already enabled by default)
3. Go to **User & Authentication** → **Email, Phone, Username** → **Email Address**
   - Make sure email verification is enabled
   - **IMPORTANT**: Set the verification method to **"Email Link"** (not "Email Code")
     - If you see an error "email_link does not match one of the allowed values", this means email link verification is not enabled
     - You need to enable it in the Clerk Dashboard first
   - Configure the redirect URL if needed (defaults to your app's URL)
   - For development, you can use Clerk's test email service

**Note about CAPTCHA Warning**: If you see a CAPTCHA warning in the console, it's harmless - Clerk will use invisible CAPTCHA instead. To enable visible CAPTCHA, you can add a `<div id="clerk-captcha"></div>` element to your page, but it's not required.

## 5. Optional: Customize Authentication URLs

If you want to customize the authentication flow, you can add these to `.env.local`:

```env
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

## 6. Run Your Application

```bash
npm run dev
```

## What Changed?

- **Authentication**: Now handled by Clerk instead of Firebase Auth
- **Firebase**: Still used for Firestore database (parcel data storage)
- **User Management**: Clerk handles user accounts, passwords, and sessions
- **User Data**: User profile data (fullName, username, unidropId) is still stored in Firestore

## Notes

- The app uses static export (`output: 'export'` in `next.config.js`), so Clerk runs entirely client-side
- User data synchronization: When a user signs up or signs in, their data is automatically synced with Firestore
- The UniDrop ID generation logic remains the same and is stored in Firestore

## Troubleshooting

If you encounter issues:

1. **"ClerkProvider: Missing publishableKey"**: 
   - Make sure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set in `.env.local`
   - Restart your development server after adding environment variables
   - Check that the key starts with `pk_test_` or `pk_live_`

2. **"Couldn't find your account" error**:
   - **For Sign In**: This means the account doesn't exist. Make sure you're using the correct email, or sign up first
   - **For Sign Up**: Check that:
     - Your Clerk application is active in the dashboard
     - Email authentication is enabled in Clerk settings
     - The email domain is allowed (if you have restrictions)
   - Verify your `.env.local` file has the correct publishable key
   - Try clearing your browser cache and cookies

3. **Authentication not working**:
   - Check that your Clerk application is active in the dashboard
   - Verify the publishable key matches your Clerk application
   - Check the browser console for detailed error messages
   - Ensure you're using the correct environment (test vs live keys)

4. **Email verification**:
   - The app uses **email link verification** (not codes)
   - When users sign up, they receive an email with a verification link
   - Users click the link to verify their email, then can sign in
   - In Clerk Dashboard → User & Authentication → Email, Phone, Username → Email Address
     - Make sure email verification is enabled
     - The verification method is set to "Email Link" (not "Email Code")
   - For development, you can use Clerk's test email service or disable email verification temporarily

5. **Build errors**: 
   - Ensure all environment variables are set before building
   - Make sure `.env.local` is in the project root (not in a subdirectory)

### Common Issues:

**Issue**: "Couldn't find your account" when trying to sign in
- **Solution**: The account doesn't exist yet. Switch to the "Register" tab and create an account first.

**Issue**: "Couldn't find your account" when trying to sign up
- **Solution**: 
  1. Check your Clerk Dashboard → API Keys to ensure the publishable key is correct
  2. Verify your Clerk application is active
  3. Check that email authentication is enabled in Clerk settings
  4. Restart your dev server after setting environment variables

**Issue**: Environment variables not loading
- **Solution**: 
  1. Make sure the file is named exactly `.env.local` (not `.env` or `.env.local.txt`)
  2. Restart your Next.js development server
  3. Check that variables start with `NEXT_PUBLIC_` for client-side access

For more help, visit [Clerk's Documentation](https://clerk.com/docs) or check the [Clerk Support](https://clerk.com/support)
