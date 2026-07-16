import os
from PIL import Image

def generate_assets():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.dirname(script_dir)
    public_dir = os.path.join(frontend_dir, "public")
    
    logo_path = os.path.join(public_dir, "reviwerbucketLogo.png")
    
    if not os.path.exists(logo_path):
        print(f"Error: Logo file not found at {logo_path}")
        return
        
    try:
        with Image.open(logo_path) as img:
            # Check format and mode
            print(f"Source image size: {img.size}")
            
            # Target sizes
            sizes = {
                "favicon-16x16.png": (16, 16),
                "favicon-32x32.png": (32, 32),
                "apple-touch-icon.png": (180, 180),
                "android-chrome-192x192.png": (192, 192),
                "android-chrome-512x512.png": (512, 512),
                "mstile-150x150.png": (150, 150),
            }
            
            # Generate pngs
            for name, size in sizes.items():
                target_path = os.path.join(public_dir, name)
                resized_img = img.resize(size, Image.Resampling.LANCZOS)
                resized_img.save(target_path, "PNG")
                print(f"Generated: {name} ({size[0]}x{size[1]})")
                
            # Generate favicon.ico (multi-resolution)
            ico_path = os.path.join(public_dir, "favicon.ico")
            ico_sizes = [(16, 16), (32, 32), (48, 48)]
            ico_images = [img.resize(size, Image.Resampling.LANCZOS) for size in ico_sizes]
            
            # Save first image with other sizes appended
            ico_images[0].save(
                ico_path,
                format="ICO",
                sizes=ico_sizes,
                append_images=ico_images[1:]
            )
            print(f"Generated: favicon.ico (containing 16x16, 32x32, 48x48)")
            
    except Exception as e:
        print(f"Error processing assets: {e}")

if __name__ == "__main__":
    generate_assets()
