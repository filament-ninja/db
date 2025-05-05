#!/bin/bash

# Navigate to the parent directory if needed, or run from there
# cd /path/to/parent/of/filaments

# Check if the filaments directory exists
if [ ! -d "vendors" ]; then
  echo "Error: Directory 'vendors' not found in the current location."
  exit 1
fi

# Find all index.yaml files exactly one level deep inside filaments
find vendors -mindepth 2 -maxdepth 2 -name index.yaml -type f | while IFS= read -r filepath; do
  # Get the directory containing index.yaml (e.g., filaments/name)
  dirpath=$(dirname "$filepath")

  # Get the name part (e.g., name)
  name=$(basename "$dirpath")

  # Define the target path (e.g., filaments/name.yaml)
  targetpath="vendors/${name}.yaml"

  # --- Safety Check (Optional but Recommended) ---
  # Uncomment the next line to see what commands *would* be run without executing them
  # echo "Would move '$filepath' to '$targetpath' and remove '$dirpath'"

  # --- Actual Execution ---
  echo "Moving '$filepath' to '$targetpath'"
  mv "$filepath" "$targetpath"

  if [ $? -eq 0 ]; then
    # If move was successful, try removing the now likely empty directory
    echo "Removing directory '$dirpath'"
    rmdir "$dirpath" || echo "Warning: Directory '$dirpath' not empty or could not be removed."
  else
    echo "Error: Failed to move '$filepath'."
  fi
done

echo "Script finished."