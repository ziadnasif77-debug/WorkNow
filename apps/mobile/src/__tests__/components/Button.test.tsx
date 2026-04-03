import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Button } from '../../components/ui'

describe('Button', () => {
  it('renders label text', () => {
    const { getByText } = render(<Button label="اضغط هنا" onPress={jest.fn()} />)
    expect(getByText('اضغط هنا')).toBeTruthy()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    const { getByText } = render(<Button label="تأكيد" onPress={onPress} />)
    fireEvent.press(getByText('تأكيد'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('shows ActivityIndicator and does not call onPress when isLoading=true', () => {
    const onPress = jest.fn()
    const { UNSAFE_queryByType, queryByText } = render(
      <Button label="تحميل" onPress={onPress} isLoading={true} />
    )
    // Label is hidden behind spinner
    expect(queryByText('تحميل')).toBeNull()
    // Spinner is shown
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ActivityIndicator } = require('react-native')
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy()
    // onPress not invoked because disabled
    expect(onPress).not.toHaveBeenCalled()
  })

  it('does not call onPress when disabled=true', () => {
    const onPress = jest.fn()
    render(<Button label="محظور" onPress={onPress} disabled={true} />)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('passes accessibilityLabel to TouchableOpacity', () => {
    const { getByLabelText } = render(
      <Button
        label="إرسال"
        onPress={jest.fn()}
        accessibilityLabel="زر إرسال النموذج"
      />
    )
    expect(getByLabelText('زر إرسال النموذج')).toBeTruthy()
  })

  it('renders outline variant without error', () => {
    const { getByText } = render(
      <Button label="ثانوي" onPress={jest.fn()} variant="outline" />
    )
    expect(getByText('ثانوي')).toBeTruthy()
  })
})
