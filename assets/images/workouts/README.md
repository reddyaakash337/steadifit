# Workout Imagery

Use imagery selectively as a hierarchy tool. Home displays one image in the Today’s Workout hero, selected from the actual scheduled or active workout. Recovery days, missing plans, and unsupported workout IDs remain image-free. Nutrition, consistency, recent activity, exercise rows, and history stay image-free.

## Available local assets

These 1376 × 768 PNGs are imported once through the shared mapping in `src/features/workoutImages.ts`:

- `push.png` — push workout
- `pull.png` — pull workout
- `legs.png` — legs / lower body
- `full-body.png` — full-body workouts
- `upper-body.png` — upper-body plan days and the catalog's `shoulders` template

The images are used for the Home hero, today's row in the weekly plan, the existing featured workout recommendation, and workout discovery cards only when real workout data maps to a category. Core and Mobility are available in the mapping but currently unused because no existing plan/template identifies those categories. Do not add images to every Train row, exercise, or history item.

When new original SteadiFit imagery is created, prefer the same wide 16:9 composition and warm, natural training environment. Show the actual movement, avoid text overlays and visible third-party brands, and keep the subject/crop compatible with a dark text-safe treatment. Do not substitute generic stock or Expo sample images.
