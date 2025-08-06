#!/usr/bin/env python3
"""Generate icon files for LexMX PWA"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    """Create a simple icon with the LexMX logo"""
    # Create a new image with a legal green background
    img = Image.new('RGB', (size, size), color='#22c55e')
    draw = ImageDraw.Draw(img)
    
    # Draw a white circle background
    margin = size // 8
    draw.ellipse([margin, margin, size - margin, size - margin], fill='white')
    
    # Draw the scales of justice symbol (simplified)
    center_x = size // 2
    center_y = size // 2
    
    # Draw the main vertical line
    line_width = max(2, size // 50)
    draw.line([(center_x, center_y - size // 4), (center_x, center_y + size // 4)], 
              fill='#22c55e', width=line_width)
    
    # Draw the horizontal balance beam
    beam_width = size // 3
    draw.line([(center_x - beam_width, center_y - size // 4), 
               (center_x + beam_width, center_y - size // 4)], 
              fill='#22c55e', width=line_width)
    
    # Draw the two balance pans
    pan_size = size // 8
    # Left pan
    draw.ellipse([center_x - beam_width - pan_size//2, center_y - size // 4 - pan_size//2,
                  center_x - beam_width + pan_size//2, center_y - size // 4 + pan_size//2],
                 outline='#22c55e', width=line_width)
    # Right pan
    draw.ellipse([center_x + beam_width - pan_size//2, center_y - size // 4 - pan_size//2,
                  center_x + beam_width + pan_size//2, center_y - size // 4 + pan_size//2],
                 outline='#22c55e', width=line_width)
    
    # Draw "MX" text at the bottom
    try:
        # Try to use a better font if available
        font_size = size // 6
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "MX"
    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    text_x = center_x - text_width // 2
    text_y = center_y + size // 6
    draw.text((text_x, text_y), text, font=font, fill='#22c55e')
    
    return img

# Generate icons
sizes = [192, 512]
public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')

for size in sizes:
    icon = create_icon(size)
    icon_path = os.path.join(public_dir, f'icon-{size}.png')
    icon.save(icon_path, 'PNG')
    print(f"Generated {icon_path}")

print("Icons generated successfully!")