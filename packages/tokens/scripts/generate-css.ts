import { themeCss } from '../src'

// Writes theme.css next to package.json; a test fails while it is out of date.
await Bun.write(new URL('../theme.css', import.meta.url).pathname, themeCss())
console.log('theme.css written.')
