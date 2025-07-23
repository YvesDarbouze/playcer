'use server';
/**
 * @fileOverview Generates a social sharing image for a bet challenge.
 *
 * - generateBetImage - A function that creates the image.
 * - GenerateBetImageInput - The input type for the function.
 * - GenerateBetImageOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GenerateBetImageInputSchema = z.object({
  challengerName: z.string().describe("The name of the user creating the challenge."),
  recipientName: z.string().describe("The name of the user being challenged."),
  betDetails: z.string().describe("A short description of the bet (e.g., 'Lakers -5.5 for $20')."),
  gameMatchup: z.string().describe("The matchup of the game (e.g., 'Lakers vs Celtics')."),
});
export type GenerateBetImageInput = z.infer<typeof GenerateBetImageInputSchema>;

export const GenerateBetImageOutputSchema = z.object({
  imageUrl: z.string().url().describe("The data URI of the generated image."),
});
export type GenerateBetImageOutput = z.infer<typeof GenerateBetImageOutputSchema>;

export async function generateBetImage(input: GenerateBetImageInput): Promise<GenerateBetImageOutput> {
  return generateBetImageFlow(input);
}

const generateBetImageFlow = ai.defineFlow(
  {
    name: 'generateBetImageFlow',
    inputSchema: GenerateBetImageInputSchema,
    outputSchema: GenerateBetImageOutputSchema,
  },
  async (input) => {
    const prompt = `Generate an epic, widescreen, cinematic sports poster for a betting challenge. The matchup is ${input.gameMatchup}.
    The image should feature iconic, abstract imagery representing the two teams, clashing in a dynamic and visually interesting way.
    The poster should have the following text clearly legible:
    - Main Title: CHALLENGE
    - Subtitle: ${input.challengerName} vs. ${input.recipientName}
    - Bet Details: ${input.betDetails}
    The style should be modern, gritty, and exciting. Use a dark, high-contrast color palette. This is for a social media post.`;

    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        aspectRatio: '16:9',
      },
    });

    if (!media.url) {
        throw new Error('Image generation failed to return a URL.');
    }

    return {
      imageUrl: media.url,
    };
  }
);
