import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

const PORT = 3000;


let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

function parseGenAiError(err: any): { isRateLimit: boolean; message: string; statusCode: number } {
  let isRateLimit = false;
  let rawMessage = err?.message || String(err || "Unknown error");
  let statusCode = err?.status || err?.statusCode || 500;
  let cleanMessage = rawMessage;

  if (typeof rawMessage === "string" && rawMessage.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error) {
        statusCode = parsed.error.code || statusCode;
        cleanMessage = parsed.error.message || cleanMessage;
        if (parsed.error.status === "RESOURCE_EXHAUSTED" || parsed.error.code === 429) {
          isRateLimit = true;
          statusCode = 429;
        }
      }
    } catch {
      // not JSON
    }
  }

  if (
    statusCode === 429 ||
    rawMessage.includes("429") ||
    rawMessage.includes("RESOURCE_EXHAUSTED") ||
    rawMessage.includes("quota") ||
    rawMessage.includes("rate limit") ||
    cleanMessage.includes("RESOURCE_EXHAUSTED") ||
    cleanMessage.includes("quota")
  ) {
    isRateLimit = true;
    statusCode = 429;
    cleanMessage = "Gemini API rate limit reached (429). The system will automatically back off and retry.";
  }

  return { isRateLimit, message: cleanMessage, statusCode };
}

async function startServer() {
  const app = express();

  // Increase payload limit for base64 images and PDFs
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));


  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Extract marksheet endpoint
  app.post("/api/extract-marksheet", async (req, res) => {
    try {
      const { imageBase64, mimeType, fileName } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 in request body." });
      }

      const ai = getAIClient();
      // Remove any data URL scheme prefix if present
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      const resolvedMime = mimeType || "image/jpeg";

      const prompt = `You are an expert marksheet and educational transcript parser.
Examine this marksheet carefully. Different educational boards (CBSE, ICSE, State Boards, Universities, etc.) format marks, student identifiers, and grades in completely varied ways.

CRITICAL INSTRUCTIONS:
1. Extract student info fields (student_name, roll_number, registration_number, date_of_birth, board, class_name, year, school) ONLY if actually present in the document. Do not guess, infer, or hallucinate values. If a field is not present, use null.
2. Return all subjects as a list of subject objects under "subjects". Never return fixed subject columns.
3. For each subject in "subjects":
   - "name": Clean official subject name as printed (e.g., "Mathematics", "English Core", "Physics", "Chemistry")
   - "marks": Student's obtained marks as a number, or null if only a grade or absent.
   - "max_marks": Maximum marks possible for this subject (e.g. 100, 50, 75) if indicated, or null.
   - "grade": Letter grade (e.g., "A1", "B+", "PASS") if printed, or null.
4. "total": Total marks obtained across subjects. If not explicitly printed on the marksheet, calculate and return the sum of all numeric subject marks obtained.
5. "percentage": Overall percentage (e.g., 85.4). If not explicitly printed on the marksheet, calculate as (total marks obtained / total maximum marks possible) * 100.
6. "low_confidence_fields": An array of field names that were blurry, faint, ambiguous, or where you have lower confidence in the OCR/interpretation (e.g. ["roll_number"] or ["subjects.0.marks"]). Return [] if everything is clear.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          student_name: { type: Type.STRING, nullable: true },
          roll_number: { type: Type.STRING, nullable: true },
          registration_number: { type: Type.STRING, nullable: true },
          date_of_birth: { type: Type.STRING, nullable: true },
          board: { type: Type.STRING, nullable: true },
          class_name: { type: Type.STRING, nullable: true },
          year: { type: Type.STRING, nullable: true },
          school: { type: Type.STRING, nullable: true },
          subjects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                marks: { type: Type.NUMBER, nullable: true },
                grade: { type: Type.STRING, nullable: true },
                max_marks: { type: Type.NUMBER, nullable: true },
              },
              required: ["name"],
            },
          },
          total: { type: Type.NUMBER, nullable: true },
          percentage: { type: Type.NUMBER, nullable: true },
          low_confidence_fields: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["subjects"],
      };

      // Try primary model gemini-2.5-flash, fallback to gemini-2.0-flash and gemini-1.5-flash
      const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      let response;
      let lastErr: any = null;

      for (const modelName of modelsToTry) {
        let retries = 3;
        let delay = 1500;

        while (retries >= 0) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: resolvedMime,
                      data: cleanBase64,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
              config: {
                responseMimeType: "application/json",
                responseSchema,
              },
            });
            break; // Success!
          } catch (callErr: any) {
            lastErr = callErr;
            retries--;
            const parsedError = parseGenAiError(callErr);

            if (retries >= 0 && parsedError.isRateLimit) {
              const jitter = Math.floor(Math.random() * 500);
              console.warn(
                `Gemini [${modelName}] rate limited (429). Retrying in ${delay + jitter}ms... (${retries} left)`
              );
              await new Promise((r) => setTimeout(r, delay + jitter));
              delay *= 2;
            } else if (retries >= 0 && (parsedError.statusCode >= 500 || callErr?.code === "ETIMEDOUT")) {
              console.warn(`Transient server error [${modelName}]. Retrying in ${delay}ms... (${retries} left)`);
              await new Promise((r) => setTimeout(r, delay));
              delay *= 1.5;
            } else {
              // Try next model if available
              break;
            }
          }
        }

        if (response) break;
      }

      if (!response && lastErr) {
        const errInfo = parseGenAiError(lastErr);
        console.error("Gemini extraction failed after retries:", errInfo.message);
        return res.status(errInfo.statusCode).json({
          success: false,
          isRateLimit: errInfo.isRateLimit,
          error: errInfo.message,
        });
      }

      const textOutput = response?.text || "{}";
      let parsedData;
      try {
        parsedData = JSON.parse(textOutput);
      } catch {
        return res.status(500).json({
          success: false,
          error: "Failed to parse JSON response from Gemini.",
          rawOutput: textOutput,
        });
      }

      if (parsedData && Array.isArray(parsedData.subjects)) {
        let sumMarks = 0;
        let sumMaxMarks = 0;
        let validMarksCount = 0;
        for (const sub of parsedData.subjects) {
          if (typeof sub.marks === "number" && !isNaN(sub.marks)) {
            sumMarks += sub.marks;
            validMarksCount++;
            const max = typeof sub.max_marks === "number" && sub.max_marks > 0 ? sub.max_marks : 100;
            sumMaxMarks += max;
          }
        }
        if ((parsedData.total === null || parsedData.total === undefined) && validMarksCount > 0) {
          parsedData.total = sumMarks;
        }
        if ((parsedData.percentage === null || parsedData.percentage === undefined) && parsedData.total && sumMaxMarks > 0) {
          parsedData.percentage = Math.round((parsedData.total / sumMaxMarks) * 10000) / 100;
        }
      }

      return res.json({
        success: true,
        data: parsedData,
        rawOutput: textOutput,
      });
    } catch (err: any) {
      const errInfo = parseGenAiError(err);
      console.error("Error in /api/extract-marksheet:", errInfo.message);
      return res.status(errInfo.statusCode).json({
        success: false,
        isRateLimit: errInfo.isRateLimit,
        error: errInfo.message,
      });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
