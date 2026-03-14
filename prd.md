# Role: You are a top-tier front-end developer and UI/UX designer.
# Task: Build a modern, responsive "digital business card" single-page website.

## 1. Visual Style (Visual Vibe)
- Use **Apple-style minimal design** or **glassmorphism**.
- Background: Use an animated, slowly shifting dark gradient (Animated Gradient Background).
- Typography: Prefer system default sans-serif fonts (e.g. Inter or Apple System Fonts) for a professional look.
- Effects: The main card should have a semi-transparent frosted-glass effect and a subtle border glow (Border Glow).

## 2. Core Features
- **Profile section:** Include a circular avatar (use a placeholder for now), name, and a job title/description with a **typewriter effect**.
- **Social link buttons:** Provide 4–5 styled icon buttons (e.g. LinkedIn, GitHub, Instagram, Email, X) with hover scale animation.
- **Interactive elements:**
  - A **dark/light mode** toggle.
  - A **one-click copy email** button; show a brief toast message after copying.
- **Dynamic QR Code:** Integrate the `qrcode.js` library at the bottom or side of the page.
  - **Use the current page URL** to generate the QR Code so others can open this card by scanning it.

## 3. Technical Requirements
- Use only HTML, CSS, and vanilla JavaScript.
- All CSS must be inside a `<style>` tag; all JS inside a `<script>` tag.
- Must be **responsive** and display well on iPhone and Android.
- Keep the code structure clear and add comments (e.g. in Chinese) to explain it to students.

## 4. Initial Action
- Generate index.html in one go; do not split it into parts.
