import React from 'react'
import { render } from '@testing-library/react-native'
import { Text } from 'react-native'
import { ErrorBoundary } from '../../components/ErrorBoundary'

describe('ErrorBoundary', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => jest.restoreAllMocks())

  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary><Text>OK</Text></ErrorBoundary>
    )
    expect(getByText('OK')).toBeTruthy()
  })

  it('renders fallback UI when a child throws', () => {
    const Bomb = () => { throw new Error('boom') }
    const { toJSON } = render(
      <ErrorBoundary><Bomb /></ErrorBoundary>
    )
    expect(toJSON()).not.toBeNull()
  })
})
