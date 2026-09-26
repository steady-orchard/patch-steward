function segmentMatches(pattern: string, segment: string): boolean {
  let pIndex = 0;
  let sIndex = 0;
  let starPatternIndex = -1;
  let starSegmentIndex = -1;

  while (sIndex < segment.length) {
    const patternChar = pIndex < pattern.length ? pattern[pIndex] : undefined;
    if (patternChar === '?' || (patternChar !== undefined && patternChar === segment[sIndex])) {
      pIndex += 1;
      sIndex += 1;
    } else if (patternChar === '*') {
      starPatternIndex = pIndex;
      starSegmentIndex = sIndex;
      pIndex += 1;
    } else if (starPatternIndex !== -1) {
      pIndex = starPatternIndex + 1;
      starSegmentIndex += 1;
      sIndex = starSegmentIndex;
    } else {
      return false;
    }
  }

  while (pIndex < pattern.length && pattern[pIndex] === '*') {
    pIndex += 1;
  }

  return pIndex === pattern.length;
}

function sequenceMatches(patternSegments: readonly string[], pathSegments: readonly string[]): boolean {
  let pIndex = 0;
  let sIndex = 0;
  let starPatternIndex = -1;
  let starSegmentIndex = -1;

  while (sIndex < pathSegments.length) {
    const patternSegment = pIndex < patternSegments.length ? patternSegments[pIndex] : undefined;
    if (patternSegment !== '**' && patternSegment !== undefined && segmentMatches(patternSegment, pathSegments[sIndex] ?? '')) {
      pIndex += 1;
      sIndex += 1;
    } else if (patternSegment === '**') {
      starPatternIndex = pIndex;
      starSegmentIndex = sIndex;
      pIndex += 1;
    } else if (starPatternIndex !== -1) {
      pIndex = starPatternIndex + 1;
      starSegmentIndex += 1;
      sIndex = starSegmentIndex;
    } else {
      return false;
    }
  }

  while (pIndex < patternSegments.length && patternSegments[pIndex] === '**') {
    pIndex += 1;
  }

  return pIndex === patternSegments.length;
}

export function matchesGlob(pattern: string, path: string): boolean {
  const pathSegments = path.split('/');

  if (!pattern.includes('/')) {
    const lastSegment = pathSegments[pathSegments.length - 1] ?? '';
    return segmentMatches(pattern, lastSegment);
  }

  const patternSegments = pattern.split('/');
  return sequenceMatches(patternSegments, pathSegments);
}

export function matchesAnyGlob(patterns: readonly string[], path: string): boolean {
  return patterns.some((pattern) => matchesGlob(pattern, path));
}
