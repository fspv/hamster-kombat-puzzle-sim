import numpy as np
import random
import string
from PIL import Image

# Define a set of specific letters (excluding 'A' and 'O')
SPECIFIC_LETTERS = [ch for ch in string.ascii_uppercase if ch not in ['A', 'O']]

# Define specific colors
GREEN = [0, 255, 0, 255]
RED = [255, 0, 0, 255]
YELLOW = [255, 255, 0, 255]

def is_similar_color(color1, color2, threshold=90):
    """
    Compare two colors and return True if they are similar.
    
    Args:
    color1, color2: List of RGB(A) values
    threshold: Maximum Euclidean distance between colors to be considered similar
    
    Returns:
    bool: True if colors are similar, False otherwise
    """
    return np.linalg.norm(np.array(color1[:3]) - np.array(color2[:3])) < threshold

def analyze_image(image_path):
    """
    Analyze the image and create a 6x6 grid based on cell colors.
    
    Args:
    image_path: Path to the image file
    
    Returns:
    list: 6x6 grid representing the analyzed image
    """
    # Load and convert the image to RGBA
    img = Image.open(image_path).convert('RGBA')
    img_array = np.array(img)
    
    height, width, _ = img_array.shape
    cell_height, cell_width = height // 6, width // 6
    
    grid = []
    for i in range(6):
        row = []
        for j in range(6):
            center_y = i * cell_height + cell_height // 2
            center_x = j * cell_width + cell_width // 2
            color = img_array[center_y, center_x]
            
            if is_similar_color(color, YELLOW):
                row.append('A')
            elif is_similar_color(color, RED):
                row.append('R')
            elif is_similar_color(color, GREEN):
                row.append('V')
            elif color[3] == 0 or is_similar_color(color, [40, 36, 36]):
                row.append('o')
            else:
                row.append('A')
        grid.append(row)
    
    return grid

def find_groups(array):
    """
    Find groups of 'V' (horizontal) and 'R' (vertical) in the array.
    
    Args:
    array: 2D list representing the grid
    
    Returns:
    dict: Groups of 'V' and 'R' with their positions
    """
    rows, cols = len(array), len(array[0])
    groups = {}
    group_id = 1
    visited = set()

    def check_horizontal(i, j):
        if j + 1 < cols and array[i][j] == array[i][j+1] == 'V':
            return [(i, j), (i, j+1)]
        return None

    def check_vertical(i, j):
        if i + 1 < rows and array[i][j] == array[i+1][j] == 'R':
            if i + 2 < rows and array[i+2][j] == 'R':
                return [(i, j), (i+1, j), (i+2, j)]
            return [(i, j), (i+1, j)]
        return None

    for i in range(rows):
        for j in range(cols):
            if (i, j) not in visited:
                if array[i][j] == 'V':
                    group = check_horizontal(i, j)
                    if group:
                        groups[group_id] = group
                        visited.update(group)
                        group_id += 1
                elif array[i][j] == 'R':
                    group = check_vertical(i, j)
                    if group:
                        groups[group_id] = group
                        visited.update(group)
                        group_id += 1


    return groups

def assign_letters_to_groups(groups):
    """
    Assign unique letters to each group.
    
    Args:
    groups: Dict of groups with their positions
    
    Returns:
    dict: Groups with assigned letters and their positions
    """
    letters = [ch.lower() for ch in string.ascii_lowercase if ch not in ['a', 'o']]
    
    if len(letters) < len(groups):
        raise ValueError("Not enough unique letters for the number of groups.")

    random.shuffle(letters)
    
    data = {}
    for (id, group), letter in zip(groups.items(), letters):
        data[id] = {
            'char': letter.upper(),
            'positions': group
        }
    
    return data

def update_array_with_letters(array, data):
    """
    Update the array with newly assigned letters.
    
    Args:
    array: Original 2D array
    data: Dict of groups with assigned letters and positions
    
    Returns:
    list: Updated 2D array with new letters
    """
    new_array = [row[:] for row in array]
    for group_info in data.values():
        for i, j in group_info['positions']:
            new_array[i][j] = group_info['char']
    return new_array

def main():
    # Analyze the image
    grid = analyze_image('image.png')

    # Find groups in the grid
    groups = find_groups(grid)

    # Assign letters to groups
    data = assign_letters_to_groups(groups)

    # Update the grid with new letters
    new_array = update_array_with_letters(grid, data)

    # Print the new array
    print("New array with random letters assigned to groups:")
    for row in new_array:
        print(' '.join(row))

    # Join all rows into a single string
    result = ''.join(''.join(row) for row in new_array)
    print(f"\nResult: {result}")

if __name__ == "__main__":
    main()