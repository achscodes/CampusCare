# NU student email generation

Mobile and web clients should use the same rules as `src/utils/nuStudentEmail.js`.

## Example

`Glenn Francis Anjobhel D. Achas` → `achasgd@students.nu-dasma.edu.ph`

## Algorithm

1. Normalize the full name (trim, collapse spaces).
2. **Surname**: last token, lowercase, no periods (e.g. `Achas` → `achas`).
3. **First initial**: first character of the first token (e.g. `Glenn` → `g`).
4. **Middle initial**: if the token before the surname is a single letter or `D.`, use its first letter; otherwise omit.
5. Local part: `{surname}{firstInitial}{middleInitial}`.
6. Domain: `@students.nu-dasma.edu.ph`.

## API

- `generateNuStudentEmail(fullName)` → full address or `null`
- `isNuStudentEmail(email)` → boolean
- `parseNuStudentEmailLocalPart(fullName)` → local part only

Staff must be able to edit the address before sending NTE email when roster data is missing or names are non-standard.
