import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from PIL import Image

# Read the JSON file
with open('src/store/locale/fr/roles.json', 'r', encoding='utf-8') as f:
    roles = json.load(f)

# Create PDF
c = canvas.Canvas("trouble_brewing_roles.pdf", pagesize=letter)
width, height = letter

# Define team headers with their visual styling
teams = {
    'townsfolk': {'title': 'Villageois', 'y_start': height - 30},
    'outsider': {'title': 'Etrangers', 'y_start': height - 410},
    'minion': {'title': 'Sbires', 'y_start': height - 540},
    'demon': {'title': 'Démons', 'y_start': height - 685}
}

# Starting position
x_start = 25
line_height = 27
icon_size = 40  # Size of the role icons

def draw_role_icon(role_id, x, y):
    try:
        # Load and resize the icon
        icon_path = f'src/assets/icons/{role_id}.png'
        img = Image.open(icon_path)
        #img = img.resize((icon_size, icon_size), Image.Resampling.BICUBIC)
        
        # Save as temporary file (reportlab needs this step)
        temp_path = f'temp_{role_id}.png'
        img.save(temp_path, 'PNG')
        
        # Draw in PDF
        c.drawImage(temp_path, x, y - icon_size, icon_size, icon_size, mask='auto')
        
        # Clean up temporary file
        import os
        os.remove(temp_path)
    except Exception as e:
        print(f"Could not load icon for {role_id}: {e}")

for team, settings in teams.items():
    y = settings['y_start']
    
    # Draw team header
    c.setFont("Helvetica-Bold", 6)
    c.drawString(x_start, y, settings['title'])
    c.setStrokeColor(colors.gray)
    c.line(x_start, y - 5, width - x_start, y - 5)
    
    # Filter roles for this team
    team_roles = [role for role in roles if role.get('edition') == 'tb' and role.get('team') == team]
    
    # Draw roles
    for role in team_roles:
        y -= line_height
        
        # Draw role icon
        draw_role_icon(role['id'], x_start, y + icon_size * .5 + line_height * .1)
        
        # Role name
        c.setFont("Helvetica-Bold", 8)
        c.drawString(x_start + 38, y, role['name'])
        
        # Role ability
        c.setFont("Helvetica", 8)
        # Split ability text into multiple lines if needed
        ability_words = role['ability'].split()
        line = ""
        for word in ability_words:
            if len(line + " " + word) < 125:  # Adjust number for line length
                line += " " + word
            else:
                c.drawString(x_start + 105, y+5, line.strip())
                y -= 5
                line = word
        if line:
            c.drawString(x_start + 105, y, line.strip())

# Save the PDF
c.save()