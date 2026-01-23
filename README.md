# Mirah Frontend

A modern React-based authentication system with role-based access for suppliers and clients. Built with React 19, Vite, and Tailwind CSS.

## Overview

Mirah Frontend is a secure authentication platform that supports multi-step OTP verification with role-based user management. Users can register as either clients or suppliers, and securely log in through a phone-based OTP verification process.

## Features

- **Phone-based Authentication**: 10-digit Indian phone number validation
- **OTP Verification**: 4-digit OTP validation (demo OTP: 1234)
- **User Registration**: Create new accounts with role selection (Client/Supplier)
- **Role-based Access**: Support for two user roles with distinct permissions
- **Session Management**: Secure session handling with localStorage
- **Responsive Design**: Mobile-first UI built with Tailwind CSS
- **Fast Refresh**: Hot Module Replacement (HMR) for seamless development

## Tech Stack

- **React 19.2.0** - UI library
- **Vite 7.2.4** - Build tool with lightning-fast dev server
- **React Router 7.12.0** - Client-side routing
- **Tailwind CSS 4.1.18** - Utility-first CSS framework
- **ESLint 9.39.1** - Code quality linting

## Project Structure

```
mirah-frontend/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── AuthForms.jsx   # Login, OTP, and Register forms
│   │   ├── AuthLayout.jsx  # Authentication page layout wrapper
│   │   └── CarouselPanel.jsx
│   ├── pages/              # Page components
│   │   └── Welcome.jsx     # Post-login welcome screen
│   ├── services/           # Business logic services
│   │   └── authService.js  # Authentication service with localStorage
│   ├── data/               # Static data
│   │   └── db.json        # Initial user database
│   ├── App.jsx            # Main app component with routing
│   ├── main.jsx           # React entry point
│   └── index.css          # Global styles
├── package.json           # Dependencies and scripts
├── vite.config.js        # Vite configuration
├── eslint.config.js      # ESLint configuration
└── index.html            # HTML entry point
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mirah-frontend
```

2. Install dependencies:
```bash
npm install
```

### Development

Start the development server with hot reload:
```bash
npm run dev
```

The application will open at `http://localhost:5173`

### Build

Create an optimized production build:
```bash
npm run build
```

### Preview

Preview the production build:
```bash
npm run preview
```

### Linting

Check code quality:
```bash
npm run lint
```

## Authentication Flow

### 1. Login
- User enters 10-digit phone number
- Navigation to OTP verification

### 2. OTP Verification
- User receives and enters 4-digit OTP
- Demo OTP: `1234`
- On success: Routes to Welcome page or Registration if user doesn't exist

### 3. Registration
- New users create account with full name
- Role selection: Client or Supplier
- Account created and auto-logged in

### 4. Welcome
- Post-login dashboard
- Displays user information and role
- Logout functionality

## Local Storage Schema

Authentication data is stored in localStorage with the following keys:

- `mirah_users` - JSON array of all registered users
- `mirah_session_user` - Current logged-in user object
- `mirah_pending_phone` - Phone number during OTP verification

## User Object Structure

```javascript
{
  id: "unique_timestamp_id",
  fullName: "User Name",
  phone: "1234567890",
  role: "user" | "supplier",
  createdAt: "ISO_timestamp"
}
```

## Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Redirect | Redirects to `/login` |
| `/login` | LoginForm | Phone number entry |
| `/otp` | OTPForm | OTP verification |
| `/register` | RegisterForm | New user registration |
| `/welcome` | Welcome | Post-login dashboard |

## Component Details

### LoginForm
- Accepts 10-digit phone numbers
- Validates input length
- Navigates to OTP or Register based on user existence

### OTPForm
- 4-digit OTP input with auto-focus
- 59-second countdown timer
- Demo OTP: `1234`

### RegisterForm
- Full name input
- Phone number (pre-filled)
- Role selection (Client/Supplier)

### Welcome
- User greeting with full name
- Role display (Client/Supplier)
- Logout functionality

## Services

### authService.js
Handles all authentication operations:
- `initDB()` - Initialize localStorage with default users
- `login(phone)` - Authenticate user by phone
- `register(userData)` - Create new user account
- `getCurrentUser()` - Get logged-in user
- `logout()` - Clear session

## Styling

The project uses Tailwind CSS with custom color variables for branding:
- Primary colors for authentication UI
- Responsive design patterns
- Consistent spacing and typography

## Development Notes

- ESLint is configured for React development
- Fast Refresh enabled for better development experience
- @tailwindcss/vite plugin for optimized CSS generation
- Strict mode enabled in React for catching potential issues

## Future Enhancements

- Backend API integration for persistent authentication
- Email OTP as alternative to SMS
- Two-factor authentication (2FA)
- User profile management
- Password-based authentication option
- Remember device functionality

## License

This project is proprietary software. All rights reserved.

## Support

For issues or questions, please contact the development team.
