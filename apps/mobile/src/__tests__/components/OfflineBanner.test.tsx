import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('../../hooks/useNetworkState', () => ({ useIsOnline: jest.fn(() => true) }))

import { OfflineBanner } from '../../components/OfflineBanner'
import { useIsOnline } from '../../hooks/useNetworkState'

const mockUseIsOnline = useIsOnline as jest.Mock

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    mockUseIsOnline.mockReturnValue(true)
    const { toJSON } = render(<OfflineBanner />)
    expect(toJSON()).toBeNull()
  })

  it('renders banner when offline', () => {
    mockUseIsOnline.mockReturnValue(false)
    const { toJSON } = render(<OfflineBanner />)
    expect(toJSON()).not.toBeNull()
  })
})
