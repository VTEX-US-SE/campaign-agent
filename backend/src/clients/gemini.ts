import { GoogleGenAI } from '@google/genai'

let client: GoogleGenAI | null = null

export function getGemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to backend/.env.')
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return client
}

export const textModel = () => process.env.GEMINI_MODEL ?? 'gemini-3.8-flash'
export const imageModel = () => process.env.GEMINI_IMAGE_MODEL ?? 'gemini-nano-banana-2.1'

export async function generateStructured<T>(prompt: string, schema: Record<string, unknown>): Promise<T> {
  const response = await getGemini().models.generateContent({
    model: textModel(),
    contents: prompt,
    config: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.8 },
  })
  const text = response.text
  if (!text) throw new Error('Gemini returned an empty response')
  return JSON.parse(text) as T
}

export interface GeneratedImage {
  data: Buffer
  mimeType: string
}

export async function generateImage(prompt: string, aspectRatio: string, fallbackAspectRatio?: string): Promise<GeneratedImage> {
  try {
    return await requestImage(prompt, aspectRatio)
  } catch (error) {
    if (!fallbackAspectRatio || fallbackAspectRatio === aspectRatio) throw error
    return requestImage(prompt, fallbackAspectRatio)
  }
}

async function requestImage(prompt: string, aspectRatio: string): Promise<GeneratedImage> {
  const response = await getGemini().models.generateContent({
    model: imageModel(),
    contents: prompt,
    config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
  })
  const parts = response.candidates?.[0]?.content?.parts ?? []
  const image = parts.find((part) => part.inlineData?.data)
  if (!image?.inlineData?.data) throw new Error('Gemini did not return an image')
  return { data: Buffer.from(image.inlineData.data, 'base64'), mimeType: image.inlineData.mimeType ?? 'image/png' }
}
