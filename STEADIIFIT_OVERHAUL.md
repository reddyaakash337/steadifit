STEADIIFIT — COMPLETE VISUAL + UX OVERHAUL
==================================================

You are working on the existing Steadiifit React Native / Expo application.

This is a REAL product, not a portfolio mockup.

The attached screenshots are the ORIGINAL STEADIIFIT DESIGN REFERENCES. Treat them as the visual and product-direction reference for this overhaul.

IMPORTANT:
Do not simply copy the screenshots pixel-for-pixel.
The current implementation has better structure and real functionality, so preserve the current architecture and functionality while bringing back the visual personality, hierarchy, richness, and product feel demonstrated by the original designs.

The goal is:

CURRENT APP
→ clean, functional, somewhat plain

TARGET APP
→ clean + premium + energetic + visually distinctive + easy to navigate + genuinely useful

The application must NOT become crowded.

==================================================
1. CORE PRODUCT PRINCIPLES
==================================================

Steadiifit should feel like one coherent fitness product.

Use these principles everywhere:

1. Every feature has ONE obvious home.
2. Every screen has ONE primary purpose.
3. Every screen should have ONE dominant visual focus.
4. Do not repeat large amounts of the same information.
5. Do not add UI merely because functionality exists.
6. Prefer hierarchy over more components.
7. Prefer meaningful content over decorative content.
8. Use visual variety without creating clutter.
9. Preserve the existing clean typography and layout language.
10. Bring back the energy and personality of the original designs.

The app should feel interesting when scrolling, but users should always understand where they are and what they can do.

==================================================
2. ORIGINAL DESIGN REFERENCES
==================================================

Use the screenshots attached to this task as the ORIGINAL STEADIIFIT DESIGN REFERENCES.

The screenshots demonstrate the intended direction for:

- Home
- Workouts / Train
- Progress
- Active Workout

Important visual characteristics from the references:

- large, confident typography
- warm off-white background
- dark brown/near-black text
- warm brown primary actions
- large workout imagery
- strong workout hero sections
- prominent workout titles
- meaningful metrics
- rounded surfaces
- selective borders
- generous spacing
- strong CTA hierarchy
- workout cards with imagery
- progress visualizations
- personal records
- goals
- recent activity
- exercise/set hierarchy
- large workout timer
- expandable exercise sections
- form tips
- simple but expressive layouts

The references should influence the implementation's:
- visual hierarchy
- information density
- spacing
- component variety
- imagery
- typography
- CTA placement
- section ordering
- overall personality

Do NOT introduce random design trends that are unrelated to the references.

==================================================
3. VISUAL DESIGN SYSTEM
==================================================

Preserve the existing Steadiifit visual identity.

Typography:
- Bricolage Grotesque for major headings
- Inter for body/UI text
- strong weight contrast
- large typography for important information
- avoid excessive tiny text

Color:
- warm off-white background
- dark brown/near-black primary text
- warm Steadiifit brown for primary actions
- lighter warm neutrals for secondary surfaces
- restrained green for positive/completed states
- red only for genuine warnings / over-target nutrition states
- do not turn the application into a multicolor dashboard

Do not introduce arbitrary bright colors simply to make the UI "exciting".

Spacing:
- generous outer margins
- strong section separation
- consistent vertical rhythm
- avoid stacking dozens of equally-sized cards

Corners:
- rounded but not excessively pill-shaped
- use larger radius for major feature surfaces
- smaller radius for controls and compact elements

Borders:
- subtle
- use borders to define important surfaces
- do not border everything

Buttons:
- one clear primary action per screen
- secondary actions should visually recede
- do not turn every action into a giant brown button
- avoid multiple floating action buttons competing for attention

Icons:
- DO NOT use emojis as UI icons.
- Use the existing icon system / vector icons.
- Keep icon style consistent.
- Icons should support hierarchy rather than become decoration.

==================================================
4. NAVIGATION ARCHITECTURE
==================================================

The bottom navigation MUST contain exactly three destinations:

1. Home
2. Train
3. Progress

Do NOT add additional bottom tabs.

Use a consistent primary header across the main screens.

Header:

LEFT:
- hamburger/menu icon

CENTER:
- screen title or Steadiifit branding depending on screen

RIGHT:
- profile/avatar

The profile/avatar must remain accessible from:
- Home
- Train
- Progress

The hamburger opens a LEFT-SIDE navigation drawer.

Drawer should contain only high-level destinations:

- Home
- Train
- Progress
- Nutrition
- Profile
- Settings
- About

Do NOT put subfeatures in the drawer.

For example:
DO NOT put:
- My Plan
- Workouts
- Exercise Library
- Personal Information

as separate drawer items.

Those belong inside their parent areas.

Navigation mental model:

HOME
= What do I need to know/do today?

TRAIN
= Everything related to training.

PROGRESS
= How am I improving?

NUTRITION
= What have I eaten and how am I doing nutritionally?

PROFILE
= Me and my personal settings.

==================================================
5. SCREEN-BY-SCREEN IMPLEMENTATION ORDER
==================================================

IMPORTANT:

Implement in this order.

Do not redesign random screens independently.

PHASE 1
GLOBAL FOUNDATION

PHASE 2
HOME

PHASE 3
TRAIN

PHASE 4
PROGRESS

PHASE 5
NUTRITION

PHASE 6
ACTIVE WORKOUT

PHASE 7
PROFILE / SECONDARY SCREENS

PHASE 8
GLOBAL POLISH / MOTION / QA


==================================================
PHASE 1 — GLOBAL FOUNDATION
==================================================

Before redesigning individual screens:

1. Inspect the existing navigation architecture.
2. Inspect the current shared UI components.
3. Inspect theme/constants.
4. Inspect existing icon usage.
5. Inspect current screen routes.
6. Identify duplicated UI patterns.
7. Reuse existing components where possible.

Create/reuse a consistent global header.

Create/reuse a consistent left-side drawer.

Ensure:
- Home has hamburger + avatar
- Train has hamburger + avatar
- Progress has hamburger + avatar
- Nutrition can use the same header
- secondary screens use appropriate contextual headers

Do not break existing routing.

Do not remove existing routes.

Do not change authentication.

Do not change Supabase schema.

Do not change persistence models.

==================================================
PHASE 2 — HOME
==================================================

HOME PURPOSE:

"What do I need to know/do today?"

Use the original Home screenshot as the primary design reference.

The current Home should feel more like a real fitness product and less like a collection of statistics.

Preferred hierarchy:

1. Header
2. Today's workout / hero
3. Nutrition snapshot
4. Compact progress metrics
5. One meaningful secondary section

--------------------------------------------------
HOME HERO
--------------------------------------------------

Bring back the original concept of a strong workout hero.

It should communicate:

- day/context
- today's workout
- workout focus
- duration / exercise count where useful
- strong primary Start Workout action

Use existing workout data.

Do NOT fabricate workout information.

If imagery is available, use it prominently.

The hero should visually dominate the screen.

Do not put a huge number of unrelated cards above it.

--------------------------------------------------
HOME NUTRITION
--------------------------------------------------

Show a compact nutrition snapshot.

Example hierarchy:

Nutrition
1,820 / 2,400 kcal

Protein
112 / 150g

Carbs
...
Fat
...

Keep it compact.

Tapping it should open Nutrition.

Do not duplicate the entire Nutrition screen on Home.

--------------------------------------------------
HOME PROGRESS
--------------------------------------------------

Use meaningful existing data such as:
- streak
- workouts this month
- recent meaningful achievement

Use strong numbers rather than several repetitive cards.

--------------------------------------------------
HOME QUICK ACTIONS
--------------------------------------------------

Only include actions that are genuinely useful.

Do NOT create a giant grid of actions just because the app supports those features.

Avoid:
- duplicate Add Food buttons
- duplicate workout navigation
- duplicate Progress navigation
- duplicate Profile navigation

--------------------------------------------------
HOME CONTENT RULE
--------------------------------------------------

Home should answer:

"What matters to me TODAY?"

Do not turn Home into the entire application.


==================================================
PHASE 3 — TRAIN
==================================================

TRAIN PURPOSE:

"Everything related to training."

Use the original Workouts screenshots as the visual reference.

Train should contain the existing training functionality in a clear hierarchy:

1. Today's Plan
2. Quick Start
3. Recommended workouts
4. Workout discovery
5. Exercise Library access
6. History where appropriate

--------------------------------------------------
TRAIN HEADER
--------------------------------------------------

Header:
hamburger
Train
profile/avatar

--------------------------------------------------
TODAY'S PLAN
--------------------------------------------------

Make today's planned workout prominent.

Example:

TODAY'S PLAN

Back + Biceps
45 min · 6 exercises

[ Start Workout ]

Do not overdecorate this.

--------------------------------------------------
QUICK START
--------------------------------------------------

Bring back the original Quick Start concept.

Use compact visual cards.

Possible existing actions:
- Today's Plan
- Repeat Last Workout
- Custom Workout

Only include actions that actually exist in the current implementation.

Do not create fake functionality.

Quick Start should feel useful without consuming most of the screen.

--------------------------------------------------
RECOMMENDED
--------------------------------------------------

Bring back the image-led workout cards from the original design.

Each card can contain:

image
difficulty
workout name
short description
duration
exercise count
focus

Primary:
Start Workout

Secondary:
Details

Do not make every card enormous.

Use visual imagery to create variety.

--------------------------------------------------
EXERCISE LIBRARY
--------------------------------------------------

Exercise Library should remain accessible through Train.

Do not make it another bottom tab.

Keep:
- search
- filters
- muscle
- equipment
- difficulty
- exercise details
- existing catalog

Use compact navigation into it.

--------------------------------------------------
HISTORY
--------------------------------------------------

History belongs within the training ecosystem.

Do not put a giant History section on the main Train landing page if it makes the screen too long.

Use a clear secondary entry point.


==================================================
PHASE 4 — PROGRESS
==================================================

PROGRESS PURPOSE:

"How am I improving?"

Use the original Progress screenshots as the primary visual reference.

Do not make Progress look like a spreadsheet.

Make it tell a visual story.

--------------------------------------------------
TOP METRICS
--------------------------------------------------

Use strong typography for headline metrics.

Examples from existing data:
- workouts
- streak
- minutes
- volume

Use existing real data.

Do not fabricate numbers.

--------------------------------------------------
WORKOUT VOLUME
--------------------------------------------------

Bring back the original chart treatment.

The chart should have:
- clear title
- timeframe
- visually understandable bars/line
- clean labeling

Do not overcomplicate the chart.

--------------------------------------------------
PERSONAL RECORDS
--------------------------------------------------

Make PRs visually prominent.

Example:

PERSONAL RECORDS

Bench Press              85 kg
Deadlift                 140 kg
Squat                    110 kg

Use green selectively for confirmed positive records.

--------------------------------------------------
GOALS
--------------------------------------------------

Bring back the goal/progress concept from the original screenshots.

Use existing goals.

Show:
- target
- current
- progress percentage
- simple progress indicator

Do not create fake goals.

--------------------------------------------------
BODYWEIGHT
--------------------------------------------------

Show bodyweight as a meaningful progress metric.

Keep it compact.

Provide a clear path to the detailed bodyweight history.

--------------------------------------------------
RECENT ACTIVITY
--------------------------------------------------

Bring back the visual concept from the original screenshot.

Use real workout history.

Do NOT use fake people/social activity.

Do NOT invent achievements.

--------------------------------------------------
PROGRESS RULE
--------------------------------------------------

Progress should show historical improvement.

Do not duplicate today's workout interface here.

Do not duplicate the complete Nutrition screen here.


==================================================
PHASE 5 — NUTRITION
==================================================

Nutrition already has:
- nutrition targets
- calories
- protein
- carbs
- fat
- food persistence
- meal logging
- edit
- delete
- quick re-add
- meal-specific suggestions

Do NOT change the underlying nutrition engine in this task.

Do NOT change the calculation model.

Do NOT change the Supabase schema.

This is a PRESENTATION + UX overhaul only.

--------------------------------------------------
NUTRITION TOP
--------------------------------------------------

Make today's nutrition immediately understandable.

Show:

Calories
consumed / target

Protein
consumed / target

Carbs
consumed / target

Fat
consumed / target

Use visual progress indicators.

--------------------------------------------------
WARNING STATES
--------------------------------------------------

Nutrition metrics should visually communicate status.

Suggested states:

NORMAL:
neutral / normal Steadiifit styling

APPROACHING TARGET:
subtle warm warning

AT TARGET:
positive styling

ABOVE TARGET:
red warning styling

Do not make normal values red.

Do not imply medical danger.

This is a nutrition tracking warning, not medical advice.

--------------------------------------------------
MEALS
--------------------------------------------------

The primary food organization should be:

Breakfast
Lunch
Dinner
Snack

Do NOT have large global Recent/Frequent sections occupying the top of Nutrition.

Food suggestions should be contextual.

When the user selects:

Breakfast

and begins entering the food name,

show small suggestions based on foods previously logged for BREAKFAST.

Likewise:

Lunch → lunch foods
Dinner → dinner foods
Snack → snack foods

Suggestions should be compact and appear directly below the food input.

Do NOT create large recommendation sections.

The intent is:

"I ate something similar before → tap it → adjust quantity → log."

This is specifically designed to reduce logging friction.

--------------------------------------------------
NUTRITION LOGGING
--------------------------------------------------

Logging food should feel fast.

Avoid forcing the user through excessive fields.

Use existing serving information where available.

Do not require them to manually calculate nutrition if the information is already known from a previous entry.

Keep edit/delete functionality obvious but unobtrusive.

==================================================
PHASE 6 — ACTIVE WORKOUT
==================================================

This is one of the most important screens in the entire product.

Use the original Active Workout screenshots as a major design reference.

The current screen already contains the correct basic concept.

Improve the presentation.

--------------------------------------------------
HEADER
--------------------------------------------------

Contextual header:

Back
Workout name
Pause

Do not use the primary bottom navigation during an active workout if it interferes with the workout experience.

--------------------------------------------------
WORKOUT SUMMARY
--------------------------------------------------

Show:

Workout name
exercise count
estimated duration
difficulty

Keep compact.

--------------------------------------------------
TIMER
--------------------------------------------------

Bring back the large timer treatment.

Timer should be visually dominant but not consume excessive space.

Include:
- elapsed time
- pause
- reset where appropriate

--------------------------------------------------
CURRENT EXERCISE
--------------------------------------------------

The current exercise should be visually dominant.

Show:
- exercise name
- target sets
- target reps
- previous performance
- current set inputs
- completion state

Use expandable/collapsible exercise sections.

Only the current exercise needs to be visually expanded by default.

Other exercises can remain compact.

--------------------------------------------------
SET LOGGING
--------------------------------------------------

Preserve existing functionality.

Do NOT change the workout data model.

Do NOT introduce unnecessary interaction steps.

The user should be able to record their set quickly.

Previous performance should be immediately visible.

--------------------------------------------------
FORM TIPS
--------------------------------------------------

Keep form tips available but compact.

Do not show huge blocks of instructional text while the user is actively training.

--------------------------------------------------
3D FUTURE SUPPORT
--------------------------------------------------

Prepare the visual layout so a future 3D exercise viewer can occupy a prominent area.

Do NOT implement the 3D system in this task.

Do NOT create a fake 3D implementation.

Just make sure the active exercise presentation can accommodate it later.


==================================================
PHASE 7 — PROFILE + SECONDARY SCREENS
==================================================

Profile remains secondary.

It is accessed from the avatar.

Profile should contain:

- profile summary
- Personal Information
- Settings
- Account functionality
- About where appropriate

Personal Information should clearly contain:
- Name
- Date of birth
- Height
- Current weight
- Unit system

Do not make Personal Information compete with the main product experience.

Settings should remain secondary.

Do not surface every setting on the main Profile page.

==================================================
PHASE 8 — GLOBAL POLISH
==================================================

After all main screens are redesigned:

1. Check spacing consistency.
2. Check typography consistency.
3. Check icon consistency.
4. Check CTA hierarchy.
5. Check navigation consistency.
6. Check card usage.
7. Check image usage.
8. Check empty states.
9. Check loading states.
10. Check error states.
11. Check mobile responsiveness.
12. Check that screens do not become excessively long without purpose.

Add subtle motion only where it provides feedback.

Appropriate examples:
- screen transitions
- expanding/collapsing exercises
- progress animation
- nutrition progress transitions
- workout completion
- drawer opening/closing

Do NOT animate everything.

Avoid flashy animation.


==================================================
9. IMPORTANT ANTI-BLOAT RULES
==================================================

These are NON-NEGOTIABLE.

1. Exactly 3 bottom tabs:
   Home
   Train
   Progress

2. Do not add more bottom tabs.

3. Do not add fake social functionality.

4. Do not add fake achievements or fake user activity.

5. Do not add decorative content with no product purpose.

6. Do not duplicate large information blocks across screens.

7. Do not add multiple competing primary CTAs.

8. Do not put every feature into the navigation drawer.

9. Do not put every feature onto Home.

10. Do not make every component a card.

11. Do not use emojis as UI icons.

12. Do not introduce a completely different visual style.

13. Do not replace Bricolage Grotesque / Inter.

14. Do not change Supabase schemas.

15. Do not change persistence architecture.

16. Do not change authentication.

17. Do not change the nutrition calculation engine.

18. Do not change the workout data model.

19. Do not remove existing functionality.

20. Do not remove existing routes.

21. Do not create placeholder functionality pretending to be implemented.

22. Do not invent data.

23. Do not add social/community features in this overhaul.

24. Do not add subscriptions/paywalls in this overhaul.

25. Do not implement the 3D exercise system in this overhaul.


==================================================
10. REAL DATA ONLY
==================================================

Whenever displaying:

- workout counts
- streaks
- calories
- protein
- PRs
- bodyweight
- workout history
- goals
- achievements

use existing application state/data.

Do not hard-code attractive numbers from the screenshots.

The screenshots are design references, NOT data sources.

If there is insufficient data:
- show an appropriate empty state
- or hide the section

Do not fabricate content.


==================================================
11. RESPONSIVENESS
==================================================

The application must remain usable on:

- phone-sized screens
- Expo web
- Android
- iOS

Do not optimize only for the screenshot dimensions.

Avoid:
- horizontal overflow
- clipped text
- buttons extending outside containers
- bottom navigation covering content
- floating elements covering important controls
- excessively tall cards

The screenshots are references for visual hierarchy, not fixed dimensions.


==================================================
12. EXISTING FUNCTIONALITY MUST SURVIVE
==================================================

Preserve all current working functionality including:

- authentication
- onboarding
- profile persistence
- personal information
- settings
- plan generation
- plan customization
- workout persistence
- active workout tracking
- workout history
- exercise library
- favorites
- progress
- bodyweight logging
- nutrition targets
- nutrition logging
- nutrition persistence
- nutrition edit/delete
- quick food re-add
- meal-specific food suggestions
- AI Coach
- existing routes

Do not rewrite backend logic simply to achieve visual changes.


==================================================
13. IMPLEMENTATION STRATEGY
==================================================

Before changing code:

1. Inspect the repository.
2. Inspect:
   - src/app/
   - src/features/
   - src/components/
   - src/constants/
   - src/state/
   - src/data/
3. Identify the current implementations of:
   - Home
   - Train
   - Progress
   - Nutrition
   - Active Workout
   - Profile
4. Identify reusable components.
5. Identify duplicated UI.
6. Identify existing navigation/header components.
7. Identify the existing icon system.
8. Identify existing image assets.

Do not blindly create new components if equivalent shared components already exist.

Prefer shared components for:
- header
- drawer
- section headings
- buttons
- metric displays
- workout cards
- progress indicators
- icon buttons


==================================================
14. EXECUTION ORDER
==================================================

Execute in this exact order:

STEP 1
Global navigation/header/drawer.

STEP 2
Home redesign.

STEP 3
Train redesign.

STEP 4
Progress redesign.

STEP 5
Nutrition redesign.

STEP 6
Active Workout redesign.

STEP 7
Profile and secondary screen cleanup.

STEP 8
Global typography/spacing/icon/image polish.

STEP 9
Responsive QA.

STEP 10
Final validation.

After each major phase, ensure TypeScript remains valid and avoid accumulating unrelated breakage.

Do NOT commit.


==================================================
15. FILE / ARCHITECTURE DISCIPLINE
==================================================

Keep changes focused.

Prefer:
- existing components
- shared styles
- shared theme constants
- reusable layout primitives

Avoid:
- huge new files
- duplicate styling
- hard-coded screen-specific design systems
- unnecessary dependencies

If a shared component is needed, create it once and reuse it.

Do not introduce a new UI framework.

Do not add unnecessary packages.

Do not change the backend architecture.


==================================================
16. REQUIRED VALIDATION
==================================================

At the end, run:

npx tsc --noEmit

git diff --check

npx expo export --platform web

If any validation fails:

1. Fix the issue.
2. Re-run the failed validation.
3. Do not report success until it passes.

Also inspect the final git diff for:
- accidental backend changes
- accidental schema changes
- accidental removal of routes
- accidental hard-coded fake data
- accidental emoji icons
- unnecessary duplicated components


==================================================
17. REQUIRED FINAL REPORT
==================================================

Do NOT commit.

When finished, report exactly:

1. OVERALL RESULT
   Briefly describe the final visual direction.

2. NAVIGATION
   Show the final:
   - bottom tabs
   - drawer items
   - profile access

3. HOME
   Describe the final hierarchy and what changed.

4. TRAIN
   Describe the final hierarchy and what changed.

5. PROGRESS
   Describe the final hierarchy and what changed.

6. NUTRITION
   Describe the final hierarchy and what changed.

7. ACTIVE WORKOUT
   Describe the final hierarchy and what changed.

8. PROFILE / SECONDARY SCREENS
   Describe what changed.

9. ORIGINAL DESIGN ELEMENTS RESTORED
   List the important elements brought back from the screenshots.

10. DUPLICATION REMOVED
    List repetitive UI or navigation that was removed.

11. FILES CHANGED
    List every modified/created file.

12. FUNCTIONALITY PRESERVED
    Confirm that existing authentication, persistence, workout, nutrition, profile, and navigation functionality remain intact.

13. VALIDATION
    Report the exact result of:
    - npx tsc --noEmit
    - git diff --check
    - npx expo export --platform web

14. GIT
    Confirm that NO commit was created.


==================================================
FINAL QUALITY BAR
==================================================

Do not stop when the application merely compiles.

The result should visibly feel like an evolution of the ORIGINAL STEADIIFIT designs.

The current implementation's cleanliness should remain.

The original designs':
- energy
- hierarchy
- imagery
- strong typography
- workout focus
- progress storytelling
- visual variety

should return.

The final application should make a user think:

"This is a polished fitness product."

NOT:

"This is a collection of clean React Native screens."

At the same time, it must remain simple enough that a new user can understand the application without being overwhelmed.

When forced to choose between:
MORE UI
and
BETTER HIERARCHY,

choose BETTER HIERARCHY.

When forced to choose between:
MORE FEATURES
and
BETTER PRESENTATION OF EXISTING FEATURES,

choose BETTER PRESENTATION.

Begin by inspecting the current implementation and then execute the overhaul in the specified order.