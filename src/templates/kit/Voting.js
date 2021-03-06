import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useRef,
} from 'react'
import {
  Field,
  GU,
  Help,
  Info,
  TextInput,
  useTheme,
  useViewport,
} from '@aragon/ui'
import { Header, PercentageField, PrevNextFooter } from '.'

const MINUTE_IN_SECONDS = 60
const HOUR_IN_SECONDS = MINUTE_IN_SECONDS * 60
const DAY_IN_SECONDS = HOUR_IN_SECONDS * 24

const DEFAULT_SUPPORT = 50
const DEFAULT_QUORUM = 15
const DEFAULT_DURATION = DAY_IN_SECONDS

function validationError(duration) {
  if (duration < 10 * MINUTE_IN_SECONDS) {
    return 'Please ensure the vote duration is equal to or longer than 10 minutes.'
  }
  return null
}

function reduceFields(fields, [field, value]) {
  if (field === 'duration') {
    return { ...fields, duration: value }
  }
  if (field === 'quorum') {
    return {
      ...fields,
      quorum: value,
      support: Math.max(fields.support, value),
    }
  }
  if (field === 'support') {
    return {
      ...fields,
      support: value,
      quorum: Math.min(fields.quorum, value),
    }
  }
  return fields
}

function Voting({ back, data, fields, next, screenIndex, screens }) {
  const { voting: votingData = {} } = data

  const [formError, setFormError] = useState()

  const [{ support, quorum, duration }, updateField] = useReducer(
    reduceFields,
    {
      support: votingData.support || DEFAULT_SUPPORT,
      quorum: votingData.quorum || DEFAULT_QUORUM,
      duration: votingData.duration || DEFAULT_DURATION,
    }
  )

  const handleSupportChange = useCallback(value => {
    setFormError(null)
    updateField(['support', value])
  }, [])

  const handleQuorumChange = useCallback(value => {
    setFormError(null)
    updateField(['quorum', value])
  }, [])

  const handleDurationChange = useCallback(value => {
    setFormError(null)
    updateField(['duration', value])
  }, [])

  const supportRef = useRef()
  const quorumRef = useRef()

  const handleSupportRef = useCallback(ref => {
    supportRef.current = ref
    if (ref) {
      ref.focus()
    }
  }, [])

  const isPercentageFieldFocused = useCallback(() => {
    return (
      (supportRef.current &&
        supportRef.current.element === document.activeElement) ||
      (quorumRef.current &&
        quorumRef.current.element === document.activeElement)
    )
  }, [])

  const prevNextRef = useRef()

  const handleSubmit = useCallback(
    event => {
      event.preventDefault()
      const error = validationError(duration)
      setFormError(error)

      // If one of the percentage fields is focused when the form is submitted,
      // move the focus on the next button instead.
      if (isPercentageFieldFocused() && prevNextRef.current) {
        prevNextRef.current.focusNext()
        return
      }

      if (!error) {
        next({
          ...data,
          voting: {
            support: Math.floor(support),
            quorum: Math.floor(quorum),
            duration,
          },
        })
      }
    },
    [data, next, support, quorum, duration, isPercentageFieldFocused]
  )

  return (
    <form
      css={`
        display: grid;
        align-items: center;
        justify-content: center;
      `}
    >
      <div
        css={`
          max-width: ${82 * GU}px;
        `}
      >
        <Header
          title="Configure template"
          subtitle="Choose your Voting app settings below."
        />

        <PercentageField
          ref={handleSupportRef}
          label={
            <React.Fragment>
              Support
              <Help hint="What’s the support?">
                <strong>Support</strong> is the percentage of votes on a
                proposal that the total support must be greater than for the
                proposal to be approved. For example, if “Support” is set to
                51%, then more than 51% of the votes on a proposal must vote
                “Yes” for the proposal to pass.
              </Help>
            </React.Fragment>
          }
          value={support}
          onChange={handleSupportChange}
        />

        <PercentageField
          ref={quorumRef}
          label={
            <React.Fragment>
              Minimum approval %
              <Help hint="What’s the minimum approval?">
                <strong>Minimum Approval</strong> is the percentage of the total
                token supply that support for a proposal must be greater than
                for the proposal to be considered valid. For example, if the
                “Minimum Approval” is set to 20%, then more than 20% of the
                outstanding token supply must vote to approve a proposal for the
                vote to be considered valid.
              </Help>
            </React.Fragment>
          }
          value={quorum}
          onChange={handleQuorumChange}
        />

        <VoteDuration duration={duration} onUpdate={handleDurationChange} />

        {formError && (
          <Info
            mode="error"
            css={`
              margin-bottom: ${3 * GU}px;
            `}
          >
            {formError}
          </Info>
        )}

        <Info
          css={`
            margin-bottom: ${3 * GU}px;
          `}
        >
          The support and minimum approval thresholds are strict requirements,
          such that votes will only pass if they achieve approval percentages
          greater than these thresholds.
        </Info>

        <PrevNextFooter
          ref={prevNextRef}
          backEnabled
          nextEnabled
          nextLabel={`Next: ${screens[screenIndex + 1][0]}`}
          onBack={back}
          onNext={handleSubmit}
        />
      </div>
    </form>
  )
}

function VoteDuration({ duration = 0, onUpdate }) {
  const theme = useTheme()
  const { above } = useViewport()

  // Calculate the units based on the initial duration (in seconds).
  const [baseDays, baseHours, baseMinutes] = useMemo(() => {
    let remaining = duration

    const days = Math.floor(remaining / DAY_IN_SECONDS)
    remaining -= days * DAY_IN_SECONDS

    const hours = Math.floor(remaining / HOUR_IN_SECONDS)
    remaining -= hours * HOUR_IN_SECONDS

    const minutes = Math.floor(remaining / MINUTE_IN_SECONDS)
    remaining -= minutes * MINUTE_IN_SECONDS

    return [days, hours, minutes]
  }, [duration])

  // Local units state − updated from the initial duration if needed.
  const [minutes, setMinutes] = useState(baseMinutes)
  const [hours, setHours] = useState(baseHours)
  const [days, setDays] = useState(baseDays)

  // If any of the units change, call onUpdate() with the updated duration,
  // so that it can get updated if the “next” button gets pressed.
  useEffect(() => {
    onUpdate(
      minutes * MINUTE_IN_SECONDS +
        hours * HOUR_IN_SECONDS +
        days * DAY_IN_SECONDS
    )
  }, [onUpdate, minutes, hours, days])

  // Invoked by handleDaysChange etc. to update a local unit.
  const updateLocalUnit = useCallback((event, stateSetter) => {
    const value = Number(event.target.value)
    if (!isNaN(value)) {
      stateSetter(value)
    }
  }, [])

  const handleDaysChange = useCallback(
    event => updateLocalUnit(event, setDays),
    [updateLocalUnit]
  )
  const handleHoursChange = useCallback(
    event => updateLocalUnit(event, setHours),
    [updateLocalUnit]
  )
  const handleMinutesChange = useCallback(
    event => updateLocalUnit(event, setMinutes),
    [updateLocalUnit]
  )

  return (
    <Field
      label={
        <React.Fragment>
          vote duration
          <Help hint="What’s the vote duration?">
            <strong>Vote Duration</strong> is the length of time that the vote
            will be open for participation. For example, if the Vote Duration is
            set to 24 hours, then tokenholders have 24 hours to participate in
            the vote.
          </Help>
        </React.Fragment>
      }
    >
      {({ id }) => (
        <div
          css={`
            display: flex;
            padding-top: ${0.5 * GU}px;
            width: 100%;
          `}
        >
          {[
            ['Days', handleDaysChange, days],
            ['Hours', handleHoursChange, hours],
            [
              above('medium') ? 'Minutes' : 'Min.',
              handleMinutesChange,
              minutes,
            ],
          ].map(([label, handler, value], index) => (
            <div
              key={label}
              css={`
                flex-grow: 1;
                max-width: ${17 * GU}px;
                & + & {
                  margin-left: ${2 * GU}px;
                }
              `}
            >
              <TextInput
                id={index === 0 ? id : undefined}
                adornment={
                  <span
                    css={`
                      padding: 0 ${2 * GU}px;
                      color: ${theme.contentSecondary};
                    `}
                  >
                    {label}
                  </span>
                }
                adornmentPosition="end"
                adornmentSettings={{
                  width: 8 * GU,
                  padding: 0,
                }}
                onChange={handler}
                value={value}
                wide
                css="text-align: center"
              />
            </div>
          ))}
        </div>
      )}
    </Field>
  )
}

function formatDuration(duration) {
  const units = [DAY_IN_SECONDS, HOUR_IN_SECONDS, MINUTE_IN_SECONDS]

  // Convert in independent unit values
  const [days, hours, minutes] = units.reduce(
    ([unitValues, duration], unitInSeconds) => [
      [...unitValues, Math.floor(duration / unitInSeconds)],
      duration % unitInSeconds,
    ],
    [[], duration]
  )[0]

  // Format
  return [
    [days, 'day', 'days'],
    [hours, 'hour', 'hours'],
    [minutes, 'minute', 'minutes'],
  ]
    .filter(([value]) => value > 0)
    .reduce(
      (str, [value, unitSingular, unitPlural], index, values) =>
        str +
        (index > 0 && index < values.length - 1 ? ', ' : '') +
        (values.length > 1 && index === values.length - 1 ? ' and ' : '') +
        `${value} ${value === 1 ? unitSingular : unitPlural}`,
      ''
    )
}

function formatReviewFields(votingData) {
  return [
    ['Support', `${votingData.support}%`],
    ['Minimum approval %', `${votingData.quorum}%`],
    ['Vote duration', formatDuration(votingData.duration)],
  ]
}

Voting.formatReviewFields = formatReviewFields
export default Voting
