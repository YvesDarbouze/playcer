'use server';
/**
 * @fileOverview Analyzes user comments to identify those describing court crowdedness.
 *
 * - analyzeComments - Analyzes comments for mentions of crowdedness.
 * - AnalyzeCommentsInput - The input type for the analyzeComments function.
 * - AnalyzeCommentsOutput - The return type for the analyzeComments function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCommentsInputSchema = z.object({
  comments: z.array(z.string()).describe('An array of user comments.'),
  locationName: z.string().describe('The name of the location the comments are for.'),
});
export type AnalyzeCommentsInput = z.infer<typeof AnalyzeCommentsInputSchema>;

const AnalyzeCommentsOutputSchema = z.object({
  crowdednessComments: z.array(z.string()).describe('Comments that mention the court being crowded.'),
});
export type AnalyzeCommentsOutput = z.infer<typeof AnalyzeCommentsOutputSchema>;

export async function analyzeComments(input: AnalyzeCommentsInput): Promise<AnalyzeCommentsOutput> {
  return analyzeCommentsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCommentsPrompt',
  input: {schema: AnalyzeCommentsInputSchema},
  output: {schema: AnalyzeCommentsOutputSchema},
  prompt: `You are an AI assistant helping to determine if a location is crowded based on user comments.

  Analyze the following user comments for {{locationName}} and identify the ones that indicate whether the court is crowded. Return only the comments which describe crowdedness.

  Comments:
  {{#each comments}}
  - {{{this}}}
  {{/each}}
  `,
});

const analyzeCommentsFlow = ai.defineFlow(
  {
    name: 'analyzeCommentsFlow',
    inputSchema: AnalyzeCommentsInputSchema,
    outputSchema: AnalyzeCommentsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
