import re

with open('frontend/src/index.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# Remove backdrop-blur-xl from glass-panel
css_content = css_content.replace('backdrop-blur-xl', '')

# Change glass-panel background to darker opaque
css_content = css_content.replace('bg-black/40', 'bg-black/90')

# Remove glass-panel:hover changes if they add value, but let's make them consistent
css_content = css_content.replace('bg-black/50', 'bg-black/95')

# Remove noise overlay
# Find body::before block and empty it or remove unwanted props
# Simplest is to just remove the background-image line we added previously?
# But the user wants it gone.
# Let's use regex to find the background-image property in body::before and remove it.
# Actually, the entire body::before block is for noise.
# Regex to remove body::before block or its content.
# content: ""; ... background-image: ... }
# Let's just comment out the background-image line.
css_content = re.sub(r'(background-image: url\("data:image/bmp;base64.*"\);)', r'/* \1 */', css_content)

# Write back
with open('frontend/src/index.css', 'w', encoding='utf-8') as f:
    f.write(css_content)

print("Successfully updated index.css for deep optimization")
