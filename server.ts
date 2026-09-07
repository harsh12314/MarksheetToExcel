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
        // Treat 503 UNAVAILABLE (capacity errors) as transient/retryable
        if (parsed.error.status === "UNAVAILABLE" || parsed.error.code === 503) {
          isRateLimit = true;
          statusCode = 503;
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

  // 503 / UNAVAILABLE / capacity errors — transient server-side, cycle to next model
  if (
    statusCode === 503 ||
    rawMessage.includes("503") ||
    rawMessage.includes("UNAVAILABLE") ||
    rawMessage.includes("No capacity") ||
    rawMessage.includes("overloaded") ||
    cleanMessage.includes("UNAVAILABLE") ||
    cleanMessage.includes("No capacity")
  ) {
    isRateLimit = true; // reuse backoff logic
    statusCode = 503;
    cleanMessage = "Gemini model capacity unavailable (503). Retrying with fallback model...";
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
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 in request body." });
      }

      const ai = getAIClient();
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      const resolvedMime = mimeType || "image/jpeg";

      const prompt = `You are an expert marksheet and educational transcript parser.
Examine this document carefully. It may contain a single student's marksheet or MULTIPLE students' marksheets/transcripts across one or more pages.

CRITICAL INSTRUCTIONS:
1. Extract ALL students present in the document into the "students" array. If there are multiple students (e.g. multi-page PDF, group marksheet, or class roster), extract EVERY student as a separate object in the "students" array. Do not stop after the first student.
2. For each student in "students":
   - "student_name": Full name of the student.
   - "roll_number": Roll number / Seat number / Hall ticket number.
   - "registration_number": Registration / PRN / Enrollment number.
   - "date_of_birth": Date of birth if present.
   - "board": Educational board or university name (e.g. CBSE, ICSE, State Board, University).
   - "class_name": Class / Course / Semester (e.g. Class X, Class XII, B.Tech Sem 4).
   - "year": Passing / Exam year.
   - "school": School / College / Institute name.
   - "subjects": List of subjects taken by this student.
   - "total": Total marks obtained for this student.
   - "percentage": Overall percentage for this student.
   - "low_confidence_fields": Array of field names that were blurry or ambiguous.
3. For each subject in "subjects":
   - "name": Clean official subject name as printed (e.g., "Mathematics", "English Core", "Physics")
   - "marks": Student's obtained marks as a number, or null if only a grade or absent.
   - "max_marks": Maximum marks possible for this subject (e.g. 100, 50, 75) if indicated, or null.
   - "grade": Letter grade (e.g., "A1", "B+", "PASS") if printed, or null.`;

      const studentSchema = {
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

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          students: {
            type: Type.ARRAY,
            items: studentSchema,
          },
        },
        required: ["students"],
      };

      // Use stable GA models first to avoid 503 capacity errors from experimental preview endpoints.
      // gemini-2.5-flash routes internally to preview infrastructure (low capacity → 503).
      // Override with GEMINI_MODEL env var if needed (e.g. GEMINI_MODEL=gemini-2.5-flash).
      const primaryModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      // Ordered by availability: stable GA models first, experimental last.
      // gemini-2.0-flash-lite is extremely high capacity — great last resort.
      const modelsToTry = [...new Set([primaryModel, "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"])];
      let response;
      let lastErr: any = null;

      for (const modelName of modelsToTry) {
        let retries = 2;
        let delay = 1000;

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
            break;
          } catch (callErr: any) {
            lastErr = callErr;
            retries--;
            const parsedError = parseGenAiError(callErr);

            if (parsedError.statusCode === 503 || (parsedError.isRateLimit && parsedError.statusCode !== 429)) {
              // 503 / capacity unavailable: don't waste retries on this model.
              // Break immediately so the outer loop tries the next model.
              break;
            } else if (retries >= 0 && parsedError.isRateLimit) {
              // 429 rate limit: back off and retry the same model
              const jitter = Math.floor(Math.random() * 500);
              await new Promise((r) => setTimeout(r, delay + jitter));
              delay *= 2;
            } else if (retries >= 0 && (parsedError.statusCode >= 500 || callErr?.code === "ETIMEDOUT")) {
              await new Promise((r) => setTimeout(r, delay));
              delay *= 1.5;
            } else {
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
      let parsedData: any;
      try {
        parsedData = JSON.parse(textOutput);
      } catch {
        return res.status(500).json({
          success: false,
          error: "Failed to parse JSON response from Gemini.",
          rawOutput: textOutput,
        });
      }

      let studentList: any[] = [];
      if (parsedData && Array.isArray(parsedData.students) && parsedData.students.length > 0) {
        studentList = parsedData.students;
      } else if (parsedData && Array.isArray(parsedData.subjects)) {
        studentList = [parsedData];
      } else if (parsedData && parsedData.student_name) {
        studentList = [parsedData];
      }

      studentList.forEach((student) => {
        if (Array.isArray(student.subjects)) {
          let sumMarks = 0;
          let sumMaxMarks = 0;
          let validMarksCount = 0;
          for (const sub of student.subjects) {
            if (typeof sub.marks === "number" && !isNaN(sub.marks)) {
              sumMarks += sub.marks;
              validMarksCount++;
              const max = typeof sub.max_marks === "number" && sub.max_marks > 0 ? sub.max_marks : 100;
              sumMaxMarks += max;
            }
          }
          if ((student.total === null || student.total === undefined) && validMarksCount > 0) {
            student.total = sumMarks;
          }
          if (
            (student.percentage === null || student.percentage === undefined) &&
            student.total &&
            sumMaxMarks > 0
          ) {
            student.percentage = Math.round((student.total / sumMaxMarks) * 10000) / 100;
          }
        }
      });

      return res.json({
        success: true,
        students: studentList,
        data: studentList[0] || null,
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
