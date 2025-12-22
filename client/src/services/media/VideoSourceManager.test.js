/**
 * Tests for VideoSourceManager
 */

import VideoSourceManager, { getBestYouTubeId } from './VideoSourceManager'

describe('VideoSourceManager', () => {
  describe('getSources', () => {
    it('should return primary source when only youtubeId provided', () => {
      const video = { youtubeId: 'primary-id' }
      const manager = new VideoSourceManager(video)
      const sources = manager.getSources()

      expect(sources).toHaveLength(1)
      expect(sources[0]).toEqual({
        type: 'youtube',
        id: 'primary-id',
        priority: 1,
        label: 'primary'
      })
    })

    it('should return all sources in priority order', () => {
      const video = {
        youtubeId: 'primary-id',
        altYoutubeId: 'alt-id',
        backupYoutubeId: 'backup-id',
        mirrorYoutubeId: 'mirror-id'
      }
      const manager = new VideoSourceManager(video)
      const sources = manager.getSources()

      expect(sources).toHaveLength(4)
      expect(sources[0].id).toBe('primary-id')
      expect(sources[1].id).toBe('alt-id')
      expect(sources[2].id).toBe('backup-id')
      expect(sources[3].id).toBe('mirror-id')
    })

    it('should skip duplicate IDs', () => {
      const video = {
        youtubeId: 'same-id',
        altYoutubeId: 'same-id',
        backupYoutubeId: 'different-id'
      }
      const manager = new VideoSourceManager(video)
      const sources = manager.getSources()

      expect(sources).toHaveLength(2)
      expect(sources[0].id).toBe('same-id')
      expect(sources[1].id).toBe('different-id')
    })
  })

  describe('getCurrentSource', () => {
    it('should return first source initially', () => {
      const video = {
        youtubeId: 'primary-id',
        altYoutubeId: 'alt-id'
      }
      const manager = new VideoSourceManager(video)
      const current = manager.getCurrentSource()

      expect(current.id).toBe('primary-id')
      expect(current.label).toBe('primary')
    })

    it('should return null if no sources', () => {
      const manager = new VideoSourceManager({})
      const current = manager.getCurrentSource()

      expect(current).toBeNull()
    })
  })

  describe('getNextSource', () => {
    it('should return next source when available', () => {
      const video = {
        youtubeId: 'primary-id',
        altYoutubeId: 'alt-id'
      }
      const manager = new VideoSourceManager(video)
      const next = manager.getNextSource()

      expect(next).not.toBeNull()
      expect(next.id).toBe('alt-id')
      expect(next.label).toBe('alternative')
    })

    it('should return null when no more sources', () => {
      const video = { youtubeId: 'primary-id' }
      const manager = new VideoSourceManager(video)
      const next = manager.getNextSource()

      expect(next).toBeNull()
    })
  })

  describe('markCurrentSourceFailed', () => {
    it('should mark current source as failed', () => {
      const video = {
        youtubeId: 'primary-id',
        altYoutubeId: 'alt-id'
      }
      const manager = new VideoSourceManager(video)
      
      manager.markCurrentSourceFailed()
      const next = manager.getNextSource()

      expect(next).not.toBeNull()
      expect(next.id).toBe('alt-id')
    })
  })

  describe('hasMoreSources', () => {
    it('should return true when more sources available', () => {
      const video = {
        youtubeId: 'primary-id',
        altYoutubeId: 'alt-id'
      }
      const manager = new VideoSourceManager(video)

      expect(manager.hasMoreSources()).toBe(true)
    })

    it('should return false when no more sources', () => {
      const video = { youtubeId: 'primary-id' }
      const manager = new VideoSourceManager(video)

      expect(manager.hasMoreSources()).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset to first source', () => {
      const video = {
        youtubeId: 'primary-id',
        altYoutubeId: 'alt-id'
      }
      const manager = new VideoSourceManager(video)
      
      manager.getNextSource()
      manager.markCurrentSourceFailed()
      manager.reset()

      const current = manager.getCurrentSource()
      expect(current.id).toBe('primary-id')
      expect(manager.getFailedCount()).toBe(0)
    })
  })
})

describe('getBestYouTubeId helper', () => {
  it('should return primary ID when available', () => {
    const video = { youtubeId: 'primary-id' }
    const id = getBestYouTubeId(video)
    expect(id).toBe('primary-id')
  })

  it('should return null when no ID available', () => {
    const video = {}
    const id = getBestYouTubeId(video)
    expect(id).toBeNull()
  })
})

