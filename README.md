# Marksheet to Excel Converter

An intelligent web application that uses Google's Gemini AI to scan, parse, and convert images and PDFs of student marksheets into clean, structured Excel spreadsheets. 

Built with React, Vite, TailwindCSS, and Node.js (Express), this application processes documents locally via the browser and extracts the grades, subjects, and student details securely without requiring any complex database setup.

## ✨ Features

- **AI-Powered OCR:** Extracts complex tabular data from varied marksheet formats (CBSE, State Boards, Universities, etc.) using Gemini AI.
- **Image & PDF Support:** Upload standard images or multi-page PDFs.
- **Excel Export:** Converts the parsed data into a downloadable `.xlsx` file instantly.
- **Privacy First:** Data is stored locally on the user's device using `IndexedDB`. No images or PDFs are stored on a central database.
- **Auto-Retry & Rate Limit Handling:** Intelligently handles Gemini API rate limits with automatic exponential backoff.
- **Batch Processing:** Upload and parse multiple marksheets in one go.

## 🚀 Getting Started (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/en) (v18 or higher recommended)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/marksheet-to-excel.git
   cd marksheet-to-excel
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Rename `.env.example` to `.env` (or create a new `.env` file) and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## ☁️ Deployment (Free Hosting via Render or Railway)

This repository is completely structured to be deployed easily on free hosting providers like [Render](https://render.com) or [Railway](https://railway.app).

1. Connect your GitHub repository to your hosting provider.
2. Set the **Build Command** to: `npm run build`
3. Set the **Start Command** to: `npm start`
4. In the provider's dashboard, add an Environment Variable: `GEMINI_API_KEY` with your actual API key.

*Note: Your `.env` file is excluded in `.gitignore` by default to ensure your API keys stay private.*

## 🛠️ Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React Icons
- **Backend / API:** Node.js, Express
- **AI Processing:** `@google/genai` (Gemini 1.5/2.0 Flash)
- **Data Export:** `xlsx`
- **Local Storage:** `IndexedDB`
