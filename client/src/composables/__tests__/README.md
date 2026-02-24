# Canvas History Unit Tests

This directory contains unit tests for the Undo/Redo system in `useCanvasHistory.js`.

## Test Coverage

The tests verify:

### 1. **History State Management**

- ✅ Initialize with empty stacks
- ✅ Correct computed properties (`canUndo`, `canRedo`)

### 2. **saveHistory() Function**

- ✅ Push state to history when object is modified
- ✅ Clear redo stack when new history is saved
- ✅ Limit history size to prevent memory issues
- ✅ Respect `isHistoryProcessing` flag
- ✅ Handle null canvas gracefully

### 3. **undo() Function**

- ✅ Correctly revert to previous state
- ✅ Do nothing if history is empty or has only initial state
- ✅ Set `isHistoryProcessing` flag during operation
- ✅ Handle errors gracefully

### 4. **redo() Function**

- ✅ Correctly reapply the state
- ✅ Do nothing if redo stack is empty
- ✅ Set `isHistoryProcessing` flag during operation
- ✅ Handle errors gracefully

### 5. **Edge Cases**

- ✅ Error handling for serialization/deserialization
- ✅ Proper cleanup of processing flags
- ✅ Memory management with history limits

## Running Tests

```bash
# Install dependencies (if not already installed)
npm install

# Run all tests once
npm run test:run

# Run tests in watch mode
npm run test

# Run tests with UI
npm run test:ui
```

## Test Structure

- **Setup**: Mocks Fabric.js and canvas operations
- **Isolation**: Each test runs with fresh state
- **Comprehensive**: Covers happy paths and edge cases
- **Error Handling**: Verifies graceful error recovery

## Prevention of Regression Bugs

These tests will catch:

- Breaking changes to the Undo/Redo API
- State management issues
- Memory leaks from unlimited history
- Race conditions during undo/redo operations
- Improper flag management causing infinite loops
