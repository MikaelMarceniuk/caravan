import { z } from 'zod'

// The new trip form's rules. Messages are next-intl keys, translated where they show (src/components/form).
// The API has the final word: its route checks the same limit (architecture.md D29, development.md §2, API).

export const newTripSchema = z.object({
	name: z.string().trim().min(1, { error: 'errors.tripNameRequired' }),
})
