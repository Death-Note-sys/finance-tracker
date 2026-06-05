# FinanceFlow

A comprehensive personal finance tracker application designed to help you manage your expenses, income, savings, and borrowings efficiently.

## Features

- **Dashboard:** Visualize your financial data with interactive charts and summaries.
- **Income Tracking:** Log and categorize your various sources of income.
- **Expense Tracking:** Keep a close eye on your spending with detailed expense entries.
- **Savings Goals:** Track your progress towards your savings targets.
- **Borrowings Management:** Manage loans and debts.
- **Secure Authentication:** User accounts protected with JWT (JSON Web Tokens) and bcrypt password hashing.

## Tech Stack

### Frontend
- **React 18**
- **Vite**
- **Recharts** (for data visualization)
- **Axios** (for API calls)
- **React Router**

### Backend
- **Node.js & Express.js**
- **MySQL2** (Database Driver)
- **JSON Web Tokens (JWT)** for authentication
- **Bcrypt.js** for password hashing
- **Deployed on [Render](https://render.com/)**

### Database
- **MySQL** hosted on **[Aiven](https://aiven.io/)**

## Getting Started

Follow these instructions to set up the project locally.

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- A MySQL database (You can set one up locally or use a cloud provider like Aiven)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

2. **Install Backend Dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install Frontend Dependencies:**
   ```bash
   cd ../client
   npm install
   ```

### Configuration

#### Server Environment Variables

Create a `.env` file in the `server` directory and add the following variables:

```env
PORT=5000
# Database Connection (e.g., Aiven MySQL credentials)
DB_HOST=your_aiven_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
DB_PORT=your_db_port

# JWT Secret for authentication
JWT_SECRET=your_super_secret_jwt_key
```

*(Note: The server uses `config/db.js` to connect. Ensure your environment variables match what the application expects).*

### Running the Application

1. **Start the Backend Server:**
   Open a new terminal terminal, navigate to the `server` directory, and run:
   ```bash
   cd server
   npm run dev
   ```
   The server will start on `http://localhost:5000`.

2. **Start the Frontend Client:**
   Open another terminal, navigate to the `client` directory, and run:
   ```bash
   cd client
   npm run dev
   ```
   The client will typically start on `http://localhost:5173` (or the port specified by Vite).

## Deployment

- The frontend can be deployed on platforms like Vercel, Netlify, or Render. A `vercel.json` file is included for Vercel deployments.
- The backend API is configured for deployment on Render. Ensure your environment variables are set correctly in your Render dashboard.
- The database is managed via Aiven. Make sure your Render backend has the correct connection string to access the Aiven database.
