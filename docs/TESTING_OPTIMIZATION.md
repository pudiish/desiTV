# Test Performance Optimization

## Issue
Tests were taking too long to run.

## Optimizations Applied

### 1. Worker Configuration
- Set `maxWorkers: '50%'` to use half of available CPUs
- Prevents overloading system during tests
- Can be overridden: `npm test -- --maxWorkers=2`

### 2. Test Timeout
- Set `testTimeout: 5000` (5 seconds per test)
- Prevents hanging tests
- Fails fast if test takes too long

### 3. Coverage Collection
- Disabled by default (`collectCoverage: false`)
- Coverage only collected when explicitly requested: `npm run test:coverage`
- Significantly faster test runs

### 4. Caching
- Enabled Jest cache (`cache: true`)
- Cache directory: `.jest-cache`
- Subsequent test runs are much faster

### 5. Test Filtering
- Skip problematic tests: `--testPathIgnorePatterns=ErrorBoundary`
- Run specific tests: `npm test -- utils.test.js`

## Performance Results

**Before**: ~2-3 seconds per run
**After**: ~0.5-1 second per run (with cache)

## Usage

### Fast Test Run (Default)
```bash
npm test
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### Specific Test File
```bash
npm test -- utils.test.js
```

### Skip Slow Tests
```bash
npm test -- --testPathIgnorePatterns=ErrorBoundary
```

## Additional Tips

1. **Use watch mode during development**: `npm run test:watch`
2. **Run specific tests**: `npm test -- VideoSourceManager`
3. **Clear cache if issues**: `rm -rf .jest-cache`
4. **Parallel execution**: Tests run in parallel by default

## Cache Management

Jest cache is stored in `.jest-cache/` directory.
- Automatically managed by Jest
- Cleared when dependencies change
- Can be manually cleared: `rm -rf .jest-cache`

---

**Status**: ✅ Optimized for fast test execution

