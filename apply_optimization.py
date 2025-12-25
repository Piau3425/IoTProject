import re

# Read noise base64
with open('noise_base64.txt', 'r', encoding='utf-8') as f:
    noise_data = f.read().strip()

# Read index.css
with open('frontend/src/index.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# Replace noise background
# Finding the line with background-image containing svg
new_bg_line = f'    background-image: url("{noise_data}");'
css_content = re.sub(r'background-image: url\("data:image/svg\+xml.*"\);', new_bg_line, css_content)

# Optimize glows (reduce blur from 10px to 5px, and others if found)
# Pattern: text-shadow: 0 0 10px
css_content = re.sub(r'text-shadow: 0 0 10px', 'text-shadow: 0 0 5px', css_content)

# Pattern: box-shadow: ... 40px ... -> reduce?
# Let's simple reduce specific known heavy glows in the file if identified.
# For now, the plan specifically mentioned neon text glows.
# Checking the file content provided in history:
# .text-neon-blue-glow { text-shadow: 0 0 10px ... }
# .text-neon-red-glow { text-shadow: 0 0 10px ... }
# .text-neon-green-glow { text-shadow: 0 0 10px ... }
# That regex above covers these.

# Write back
with open('frontend/src/index.css', 'w', encoding='utf-8') as f:
    f.write(css_content)

print("Successfully updated index.css")
