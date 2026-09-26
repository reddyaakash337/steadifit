---
name: steadifit-ui
description: SteadiFit UI and UX design system. Use this skill whenever modifying SteadiFit screens, navigation, layouts, components, visual design, workout presentation, nutrition presentation, or responsive UI.
---

# SteadiFit UI/UX Rules

## Product

SteadiFit is a premium mobile fitness application built with React Native, Expo, TypeScript, and Expo Router.

The goal is a polished fitness product that feels energetic, useful, modern, and visually distinctive without becoming crowded.

## Design principles

- Every screen has one primary purpose.
- Every screen has one dominant visual focus.
- Prefer hierarchy over adding components.
- Prefer meaningful content over decoration.
- Do not add UI simply because functionality exists.
- Avoid unnecessary cards.
- Avoid excessive whitespace.
- Avoid excessive visual density.
- Do not create fake data.
- Do not create fake achievements, activity, statistics, or recommendations.
- Preserve existing functionality unless explicitly asked to change it.

## Typography

- Bricolage Grotesque for major headings and prominent display text.
- Inter for body text and UI.
- Use strong typography hierarchy.
- Avoid excessive tiny text.
- Use large confident headings where appropriate.

## Colors

Use the existing SteadiFit color system.

Visual direction:
- warm off-white backgrounds
- dark brown / near-black text
- warm SteadiFit brown for primary actions
- warm neutral surfaces
- restrained green for positive/completed states
- red only for genuine warnings or above-target nutrition states

Do not introduce unrelated colors.

## Navigation

Exactly three primary bottom tabs:

- Home
- Train
- Progress

Do not add additional bottom tabs.

The primary header should maintain:

- hamburger/menu on the left
- centered branding/title
- avatar on the right

The drawer should contain:

- Home
- Train
- Progress
- Nutrition
- Profile
- Settings
- About

Do not add subfeatures to the drawer.

## Imagery

Imagery should be selective.

The purpose of imagery is to prevent the interface from feeling visually plain, not to make every screen image-heavy.

Use:
- one strong workout image in the Home workout hero
- occasional image-led workout cards in Train
- imagery only where it improves hierarchy or provides useful context

Do NOT:
- put an image in every card
- put images in every section
- create image galleries
- add decorative images merely to fill whitespace
- use images on Progress just for decoration
- use large photography on Nutrition unless it has a clear purpose
- use images in Active Workout when they distract from workout execution

A screen should still have strong visual hierarchy without relying on images everywhere.

## Workout imagery

Use local SteadiFit assets from:

assets/images/workouts/

Available categories may include:

- lower-body
- upper-body
- push
- pull
- legs
- core
- full-body
- mobility

Use the image corresponding to real workout/category data.

Never invent a workout category solely to display an image.

Do not download random stock images.

Do not introduce external image services unless explicitly requested.

## Home

Home answers:

"What matters to me today?"

Preferred hierarchy:

1. Header / SteadiFit branding
2. Today's workout hero
3. Compact nutrition snapshot
4. Meaningful consistency/progress metrics
5. Recent activity when real data exists

The workout hero should be the dominant visual element.

Do not fill unused space with arbitrary sections.

## Train

Train is the home for training-related functionality.

Use visual hierarchy for:

- Today's Plan
- Quick Start
- Recommended workouts
- Workout discovery
- Exercise Library
- History

Use workout imagery selectively.

Do not make every exercise or history item image-based.

## Progress

Progress answers:

"How am I improving?"

Prioritize:
- meaningful metrics
- workout volume
- PRs
- goals
- bodyweight
- recent activity

Prefer charts, typography, numbers, and meaningful visualization over photography.

Never invent social activity or achievements.

## Nutrition

Nutrition answers:

"What am I eating and how am I tracking?"

Prioritize:
- calories
- protein
- carbs
- fat
- target progress
- meals
- fast logging

Do not add unnecessary photography.

Meal logging should be fast.

If the user enters Nutrition through:

"Add Dinner"

the meal is already known.

Do not ask the user to select Dinner again.

Preserve the existing meal value internally.

## Active Workout

Active Workout is a focused execution screen.

Prioritize:
- workout name
- timer
- current exercise
- target sets/reps
- previous performance
- current set input
- completion state

Avoid distracting decorative elements.

## Icons

Do not use emojis as UI icons.

Use the existing icon system.

Do not introduce a new icon library unnecessarily.

## Animation

Use subtle animation for meaningful feedback:

- transitions
- expand/collapse
- progress changes
- nutrition transitions
- workout completion
- drawer opening

Avoid flashy animation.

## Data and architecture

Do not modify without explicit instruction:

- Supabase schema
- authentication
- persistence
- nutrition calculations
- workout data model
- existing routes
- existing backend architecture

Reuse existing components and data.

Do not create duplicate components when an existing component can be reused.

Do not add unnecessary dependencies.

## Responsive design

Always consider:

- small phones
- normal phones
- Android
- iOS
- Expo web
- desktop web

Check for:

- text clipping
- horizontal overflow
- buttons hidden behind navigation
- awkward image crops
- excessive whitespace
- overly large cards

## Validation

After meaningful UI changes, run:

npx tsc --noEmit

git diff --check

When appropriate:

npx expo export --platform web

Do not commit unless explicitly requested.

## Implementation philosophy

When choosing between:

"add more UI"

and

"make existing UI communicate better"

choose the second.

When choosing between:

"add another image"

and

"improve typography, spacing, hierarchy, or composition"

choose the second unless the image has a clear purpose.

The final result should feel like a polished fitness product, not a collection of generic React Native screens.