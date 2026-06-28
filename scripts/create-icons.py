#!/usr/bin/env python3
"""
FoxiFill icon generation script.
Uses PIL (Pillow) to generate PNG icons in required extension sizes.
"""

import os
import sys
import argparse

def create_icons():
    """Generate extension icons."""
    
    # Path configuration
    script_dir = os.path.dirname(os.path.abspath(__file__))
    extension_dir = os.path.dirname(script_dir)
    project_root = os.path.dirname(os.path.dirname(extension_dir))
    
    # Source icon path
    source_icon = os.path.join(project_root, "01-vi", "icon.png")
    icons_dir = os.path.join(extension_dir, "public", "icons")
    required_icon_files = [
        os.path.join(icons_dir, f"icon{size}.png")
        for size in [16, 32, 48, 128]
    ]
    
    print("FoxiFill icon generator")
    print(f"Source icon: {source_icon}")
    print(f"Output directory: {icons_dir}")
    
    # Check source file
    if not os.path.exists(source_icon):
        if all(os.path.exists(icon_file) for icon_file in required_icon_files):
            print("Source icon not found. Existing extension icons are present, skipping regeneration.")
            return True
        print(f"Error: source icon file not found: {source_icon}")
        print("Expected existing icon files in public/icons when building outside the original monorepo.")
        return False

    try:
        from PIL import Image
    except ImportError:
        print("Error: missing Pillow dependency")
        print("Install with: pip install Pillow")
        return False
    
    # Create output directory
    os.makedirs(icons_dir, exist_ok=True)
    
    try:
        # Load source icon
        print("Loading source icon...")
        with Image.open(source_icon) as source_img:
            print(f"   Size: {source_img.size}")
            print(f"   Mode: {source_img.mode}")
            
            # Ensure the image has an alpha channel.
            if source_img.mode != 'RGBA':
                source_img = source_img.convert('RGBA')
            
            # Required extension icon sizes
            sizes = [16, 32, 48, 128]
            
            for size in sizes:
                print(f"Generating {size}x{size} icon...")
                
                # Resize with high-quality resampling.
                resized = source_img.resize((size, size), Image.Resampling.LANCZOS)
                
                # Save PNG
                png_path = os.path.join(icons_dir, f"icon{size}.png")
                resized.save(png_path, "PNG", optimize=True)
                
                # Validate file
                file_size = os.path.getsize(png_path)
                print(f"   Created {png_path} ({file_size} bytes)")
                
                # Also generate a simplified SVG variant.
                svg_content = create_svg_icon(size)
                svg_path = os.path.join(icons_dir, f"icon{size}.svg")
                with open(svg_path, 'w', encoding='utf-8') as f:
                    f.write(svg_content)
                print(f"   Created {svg_path}")
        
        # Copy the original logo as a reference asset.
        try:
            logo_src = os.path.join(project_root, "01-vi", "logo.svg")
            if os.path.exists(logo_src):
                import shutil
                logo_dst = os.path.join(icons_dir, "logo-original.svg")
                shutil.copy2(logo_src, logo_dst)
                print(f"Copied original logo: {logo_dst}")
        except Exception as e:
            print(f"Could not copy logo: {e}")
        
        print("Icon generation completed.")
        print("FoxiFill extension icons are ready.")
        return True
        
    except Exception as e:
        print(f"Error generating icons: {e}")
        return False

def create_svg_icon(size):
    """Create an SVG icon variant."""
    return f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad{size}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#F67B26;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#E56920;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#CC5610;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow{size}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#00000020"/>
        </filter>
    </defs>
    
    <!-- Rounded background -->
    <rect width="{size}" height="{size}" rx="{size * 0.15}" ry="{size * 0.15}" 
          fill="url(#grad{size})" filter="url(#shadow{size})" />
    
    <!-- FoxiFill mark -->
    <text x="{size * 0.5}" y="{size * 0.65}" 
          font-family="Arial, -apple-system, sans-serif" 
          font-size="{size * 0.4}" 
          font-weight="bold" 
          fill="white" 
          text-anchor="middle" 
          dominant-baseline="middle">F</text>
    
    <!-- Accent dot -->
    <circle cx="{size * 0.8}" cy="{size * 0.2}" r="{size * 0.05}" 
            fill="white" opacity="0.8" />
</svg>'''

def check_dependencies():
    """Check dependencies."""
    try:
        import PIL
        print(f"Pillow version: {PIL.__version__}")
        return True
    except ImportError:
        print("Error: missing Pillow dependency")
        print("Install with: pip install Pillow")
        return False

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='FoxiFill icon generator')
    parser.add_argument('--check', action='store_true', help='Check dependencies')
    args = parser.parse_args()
    
    if args.check:
        return 0 if check_dependencies() else 1

    success = create_icons()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
