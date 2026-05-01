import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { StarRating, ProviderCard, CategoryChip } from '../../components/marketplace'

jest.mock('@workfix/utils', () => ({ formatPrice: jest.fn((a) => String(a)) }))

describe('StarRating', () => {
  it('renders with rating and total', () => {
    const { toJSON } = render(<StarRating rating={4.5} total={12} />)
    expect(toJSON()).not.toBeNull()
  })

  it('renders small size without count', () => {
    const { toJSON } = render(<StarRating rating={3} total={5} size="sm" showCount={false} />)
    expect(toJSON()).not.toBeNull()
  })
})

describe('ProviderCard', () => {
  const baseProps = {
    id: 'prov-1',
    type: 'individual',
    avgRating: 4.2,
    totalReviews: 8,
    onPress: jest.fn(),
  }

  it('renders vertical card', () => {
    const { toJSON } = render(<ProviderCard {...baseProps} displayName="Ahmed" />)
    expect(toJSON()).not.toBeNull()
  })

  it('renders horizontal card', () => {
    const { toJSON } = render(
      <ProviderCard {...baseProps} displayName="Sara" horizontal basePrice={50} distanceKm={1.5} />
    )
    expect(toJSON()).not.toBeNull()
  })

  it('renders with avatar URL', () => {
    const { toJSON } = render(
      <ProviderCard {...baseProps} avatarUrl="https://example.com/img.jpg" isVerified isOnline />
    )
    expect(toJSON()).not.toBeNull()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    const { getByTestId, UNSAFE_getAllByType } = render(
      <ProviderCard {...baseProps} onPress={onPress} displayName="Test" />
    )
    // Trigger press on the TouchableOpacity
    const { TouchableOpacity } = require('react-native')
    const buttons = UNSAFE_getAllByType(TouchableOpacity)
    fireEvent.press(buttons[0])
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('CategoryChip', () => {
  it('renders unselected chip', () => {
    const { toJSON } = render(<CategoryChip label="تنظيف" icon="🧹" onPress={jest.fn()} />)
    expect(toJSON()).not.toBeNull()
  })

  it('renders selected chip', () => {
    const { toJSON } = render(
      <CategoryChip label="كهرباء" selected onPress={jest.fn()} />
    )
    expect(toJSON()).not.toBeNull()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    const { UNSAFE_getAllByType } = render(
      <CategoryChip label="سباكة" onPress={onPress} />
    )
    const { TouchableOpacity } = require('react-native')
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0])
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
