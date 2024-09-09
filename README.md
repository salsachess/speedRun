# Speed Run

This codebase represents a Vue.js application called "Speed Run" that is designed for tracking and visualizing chess game statistics. Here's a high-level overview of what the application does:

1. Project Setup:

   - The project is set up using Vue 3 with TypeScript, Vite as the build tool, and Pinia for state management.
   - It includes various development tools like ESLint, Prettier, and Playwright for testing.

2. Main Application Structure:

   - The main entry point is `src/main.ts`, which initializes the Vue app, sets up Pinia, and mounts the app to the DOM.
   - `src/App.vue` serves as the root component, using Vue Router to render different pages.

3. Routing:

   - The router (`src/router/index.ts`) defines two main routes:
     - A configuration page (`/`)
     - A games page (`/games/nick/:nick?/startTS/:startTs?/timeClass/:timeClass?`)

4. Pages:

   - Configuration Page (`src/pages/PConfig.vue`):

     - Allows users to input their chess.com nickname, select a time class, and choose a start date.
     - Generates a URL for the games page based on the input.

   - Games Page (`src/pages/PGames.vue`):
     - Fetches and displays chess game data for the specified user.
     - Shows statistics like win/loss/draw counts and total game time.
     - Renders a graph of the player's rating over time using the nvd3 library.

5. Data Management:

   - The `gamesStore` (`src/stores/gamesStore.ts`) handles fetching and processing chess game data from the chess.com API.
   - It includes functions to fetch games, analyze them, and prepare data for visualization.

6. Visualization:

   - The application uses the nvd3 library (based on d3.js) to create a line chart of the player's rating over time.
   - Custom CSS (`public/libs/nv.d3.css`) is included for styling the chart.

7. Styling:

   - The app uses a combination of scoped component styles and global CSS (`src/assets/main.css` and `src/assets/normalize.css`) for layout and design.

8. Testing and Development:
   - The project includes configuration for Vitest (unit testing) and Playwright (end-to-end testing).
   - Various configuration files are present for TypeScript, ESLint, and Prettier to ensure code quality and consistency.

In summary, this application allows users to input their chess.com username and view statistics and a rating graph for their recent games, with the ability to filter by time class and start date. The app fetches data from the chess.com API, processes it, and presents it in a visually appealing way using Vue.js and d3.js-based charting.
