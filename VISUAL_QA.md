# Local Visual QA

The authenticated SteadiFit UI can be previewed locally without a Supabase account by explicitly enabling the development-only fixture:

```sh
EXPO_PUBLIC_VISUAL_QA=true npm run web -- --port 8091
```

Visual QA mode is enabled only when both `__DEV__` and `EXPO_PUBLIC_VISUAL_QA=true` are true. It supplies representative profile, plan, workout-history, body-weight, and nutrition data through the existing in-memory repository. Fixture IDs are stable; dates are positioned relative to the local current date so the weekly and monthly views remain useful.

In this mode, Supabase auth session listeners/reads, repository initialization, sign-up/sign-in, and all profile, settings, plan, workout, body-weight, and nutrition persistence calls are skipped. UI interactions update only the in-memory QA session. No Supabase user is created or modified. Do not set the variable in production; production builds cannot enable the mode because `__DEV__` is false.

When the variable is absent or not exactly `true`, the regular Supabase authentication and persistence flow is unchanged.
