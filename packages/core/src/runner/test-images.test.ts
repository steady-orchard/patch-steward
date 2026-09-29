import { describe, expect, it } from 'vitest';

// busybox tag 1.37.0, linux/amd64 platform; the digest keeps the container tier reproducible.
export const SHELL_TEST_IMAGE = 'docker.io/library/busybox@sha256:bdf57e528e45e4433820e045b29b4597825a1c9e38353532d90a01445013f82e';

// node tag 24-slim (Node 24.22.1), linux/amd64 platform; the digest keeps the container tier reproducible.
export const NODE_TEST_IMAGE = 'docker.io/library/node@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205';

describe('test images', () => {
  it('pins the test images by digest', () => {
    expect(SHELL_TEST_IMAGE).toMatch(/^docker[.]io[/]library[/]busybox@sha256:[0-9a-f]{64}$/);
    expect(NODE_TEST_IMAGE).toMatch(/^docker[.]io[/]library[/]node@sha256:[0-9a-f]{64}$/);
  });
});
