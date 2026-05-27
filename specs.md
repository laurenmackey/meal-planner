# Meal Planner Specs

## Overview
I'd like to build a meal planner app to help automate the work of:
1. Choosing recipes for our family meals for the week. This includes making sure recipes are varied, generally weeknight friendly, and healthy.
2. Creating the grocery list based on those meals plus normal weekly staples that we always buy, with some way to factor in that we may already have some ingredients.

## Specs
- I'd like to use typescript on the front and back end, node, react, and postgres
- I plan to split this work into milestones. I'd like to tackle each milestone one at a time, review the work, then move onto the next milestone.

### Milestone 1 - Basic Setup
- Create a postgres database with the following tables and schemas:
  - meals
    - id (required)
    - created_at (required)
    - updated_at (required)
    - name (required)
    - url
    - source_name
    - description
    - notes
    - prep_time
    - cook_time
    - main_protein (check constraint: chicken, beef, pork, turkey, fish, shrimp, prawns, crab, tofu, none, other)
    - rating (required, constrained from 1 to 10)
    - easiness_score (required, constrained from 1 to 10)
    - health_score (required, constrained from 1 to 10)
    - serving_size (required)
    - tags (via separate tags table and meal_tags join table)
  - food_staples
    - id (required)
    - created_at (required)
    - updated_at (required)
    - name (required)
    - description
    - notes
  - food_selections
    - id (required)
    - chosen_at (required)
    - updated_at (required)
    - status (required, defaults to proposed, other options are rejected or accepted)
    - meal_id (fk to meals.id)
    - food_staple_id (fk to food_staples.id, one of this or meal_id column is required)
  - tags
    - id (required)
    - name (required, unique)
  - meal_tags
    - meal_id (fk to meals.id)
    - tag_id (fk to tags.id)
    - primary key is (meal_id, tag_id)
  - ingredients
    - id (required)
    - created_at (required)
    - updated_at (required)
    - meal_id (required, fk to meals.id)
    - name (required)
    - optional (required, defaults to false)
    - quantity (required, decimal to support values like 0.5, 1.5)
    - measurement_unit (required, check constraint: cups, tbsp, tsp, oz, lb, g, ml, l, whole, cloves, pinch, to_taste)
    - notes

- Create a migration file to seed the database with some sample data for meals, staples, and ingredients

- Create a backend server with an API called chooseWeeklyMeals. This API is responsible for choosing a certain number of meals from the database. The number of meals to generate should be in the request, and the default should be 3 if nothing is sent.
  - The meals recommended should either not exist in food_selections or not have been chosen any time in the last 3 weeks (determined by looking at the chosen_at date in the meals table, ignores status so that rejected meals are not recommended again).
  - They can be meals with different rating and easiness numbers, but we should try to prioritize easier and higher-rating meals. We should use a ranking system to rank all the possible meals by a variety of factors and then return the top n ranked meals.
  - This recommendation engine could consider things like: protein rotation, easiness, health score, etc.
  - If there are not enough meals that meet this criteria, we should just return the meals that do meet it. Before returning, we should store the meals in the food_selections table.

- Create another API called rejectFoodItem. This API should take an array of food_selection_ids and set the status of these ids to rejected in the food_selections table.

- Create a frontend with a button to generate meals and input for how many meals to generate that will hit chooseWeeklyMeals and then display the results. The input should default to 3. Allow the user to reject one or all meals via a link for each meal displayed that removes it from the UI and hits rejectFoodItem to set its status to rejected in food_selections. They should be able to generate new meals via the same generate input and button. The input should have a number auto-populated that takes into account the previous number used - the number of currently accepted meals (e.g. if you originally request 3 meals and reject 1, the input should default to 2).

- Note: ingredient name normalization will be important for aggregation in Milestone 4 (e.g. "onion" vs "yellow onion"). Plan to address this more robustly in Milestones 5/8 when scraping recipes from external sources.

### Milestone 2 - Hosting and Auth
- Determine a plan for hosting and auth. Can we use vercel with a database for free? How do we manage logins?

### Milestone 3 - Scrape NYTimes Cooking for Recipes
- Can we integrate with claude agent to do this for us?
- Should be able to take a URL and parse the meal and ingredients, then save the data to the database
- Can we expand this to do the same for other (non NY Times Cooking) url's?

### Milestone 4 - Automation Setup
- Create cron job infrastructure to have a job that runs every Friday at 5pm PT. This job should hit the API chooseWeeklyMeals and then generate an email that lists the meals chosen and sends to lauren.m.mackey@gmail.com for now, but has the option to send to other emails in the future. The email should also contain a link to view the options in the UI and reject them there if needed.

### Milestone 5 - Ingredients and Staples
- Update UI to only show the meals generated for this week. Add ability to see past meals in a calendar or other easily digestible view.

- Add a button to the UI to Accept and Generate Ingredients. This should hit two new API's: acceptMeals which takes food_selection_ids to accept and sets their status to accepted in food_selections, and generateIngredients, which looks up the ingredients needed for the meal_ids chosen and returns them in an aggregated fashion (e.g. 2 onions + 1 onion = 3 onions). The UI should display the ingredients in a list that allows the user to delete any from the list or edit the quantity or measurement_unit.

- There should also be a link added for each meal to be able to edit the quantity. For example, the meals will have a serving_size stored in the db, which could mean "this meal feeds 4 people", meaning the ingredients tied to this meal will be enough for 4 people. However, you should be able to 1.5x, 2x, etc. the quantity, and the generateIngredients API should take this in as an argument and factor it in when returning the list of ingredients. The quantity adjustment could be a dropdown since we typically only need to 1.5x, 2x, or 3x a meal.

- To integrate staples, we can assume that everything in the staples table would need to be added to the grocery list weekly. Update the cron job to call a new API, chooseWeeklyStaples that adds everything from that table to the food_selections table for this week, and then displays it in the UI in a separate section from the meals, but with the same UI to allow editing the quantity or removing a staple from the list. Removing a staple from the weekly list uses the rejectFoodItem API.

- There should be a new button for Send Ingredients to List. This implementation is TBD. We currently use Google Keep for our grocery list, not sure if it's feasible to build an API that updates our Google Keep list or if we should use something else for our list. Ideally it would add to an existing list and not overwrite anything already there. It would send all the staples and all the ingredients for the meals, including any adjustments made to quantity, measurement unit, etc. to the list. Ideally we could group the ingredients by store section as well.

### Milestone 6 - Google Calendar Integration
- Once recipes are accepted, create google calendar invites for them.

### Milestone 7 - More to the UI
- View all recipes by protein, with a caret to view ingredients. Allow editing of fields here too.

- Adjust family settings page (average difficulty, how many fish per week, etc), then algorithm takes these into account

- Make sure email linking to view recipe works correctly (should click out to site). Is it worth parsing and storing recipe on our end?

- Make sure UI shows anything that would be useful for app, such as notes for an ingredient (and saves that to list) or notes for a recipe

- Add CRUD APIs and a simple UI for managing the master food_staples table (adding new staples, editing, or permanently removing ones you no longer buy weekly). Do the same for the meals and ingredients. You should be able to add staples to the db from the search bar on the main page

- Login: can you login with google oauth now that we have that set up for google calendar? Only worth adding if it's straightforward

### Milestone 8 - Recipes and Ingredients from Recipe Pictures
- Can we integrate with claude agent to do this for us?

### Milestone 9 - Resend custom domain and email cleanup
- Set up custom domain on Resend so the weekly email will send to Spencer along with me
- Remove logic related to RESEND_ALLOWED_EMAILS
- Make sure email flow makes sense - Do you then still have to manually generate the ingredients or can you just do it automatically from email once meals are accepted?
- Debug why cron job didn't work (email didn't send on Friday at 5pm PT) - Weekly meal cron job failed: Error: Missing API key. Pass it to the constructor `new Resend("re_123")`
    at new Resend (/app/node_modules/resend/dist/index.cjs:1087:25)
    at getResend (/app/dist/cron/weeklyMeals.js:17:12)
    at runWeeklyMealJob (/app/dist/cron/weeklyMeals.js:99:34)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async Timeout._onTimeout (/app/node_modules/node-cron/dist/cjs/scheduler/runner.js:70:44)

### Milestone 10 - Add real data to prod db

### Milestone 11 - Save from chatgpt
- Can we ask chatgpt to save the recipe it just generated to our db so we can use it going forward?

### Milestone 12 - Tests
- Add core unit and integration tests

### Potential future features:
1. Scraping sites like NYT Cooking to recommend new recipes to add to the db. Claude could score recipes against our preferences and recommend new ones to add.
2. Smarter ingredients list. Let you take a picture of the fridge and pantry and generate ingredients list accounting for what we already have.
3. Agentic interactions (TBD how useful this would be). Instead of clicking buttons in the UI to regenerate/edit quantities/etc, can we have more of a text-based interaction with an agent interface to adjust the meals OR to find new meals to add?