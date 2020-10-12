import { Form as FinalForm, FormSpy } from 'react-final-form';
import FieldRadioButton from '../FieldRadioButton/FieldRadioButton';
import { Button } from '../index';
import React from 'react';
import FieldCheckbox from '../FieldCheckbox/FieldCheckbox';

import css from './MaximumConsultationAvailableForm.css';
import classNames from 'classnames';
import FieldTextInput from '../FieldTextInput/FieldTextInput';

const EnumMaximumConsultationsType = {
  unlimited: "unlimited",
  limited: "limited",
};

const EnumMaxNumberType = {
  hoursPerDay: "hoursPerDay",
  numberPerDay: "numberPerDay",
  numberPerWeek: "numberPerWeek",
};

const FormValues = {
  MaxConsultations: "MaxConsultations",
  LimitTypes: "LimitTypes",
  Limitations: "Limitations",
};

const initialLimitations = {
  hoursPerDay: null,
  numberPerDay: null,
  numberPerWeek: null,
};

const prepareData = (formValues) => {
  if (formValues[EnumMaximumConsultationsType.unlimited]) {
    return initialLimitations;
  } else {
    const { Limitations } = formValues || {};
    return {
      ...initialLimitations,
      ...Limitations,
    }
  }
};

const getCheckboxId = (type) => `${type}.isEnabled`;

const getInitialFormValues = (data) => {
  if (
    data === undefined
    || Object.values(data).every(value => value === null)
  ) {
    return {
      [FormValues.MaxConsultations]: EnumMaximumConsultationsType.unlimited,
    };
  } else {
    const enabledFields = Object.entries(data).reduce((result, [key, value]) => {
      if (value) {
        return [...result, getCheckboxId(key)];
      }

      return result;
    }, []);
    return {
      [FormValues.MaxConsultations]: EnumMaximumConsultationsType.limited,
      [FormValues.LimitTypes]: enabledFields,
      [FormValues.Limitations]: data,
    }
  }
};

const MaximumConsultationAvailableForm = ({ onSubmit, savedData }) => {
  const prevTypeValue = React.useRef(EnumMaximumConsultationsType.unlimited);

  const handle = (param) => {
    onSubmit({
      ...prepareData(param),
    });
  };

  return (
    <FinalForm
      onSubmit={handle}
      initialValues={getInitialFormValues(savedData)}
      render={fieldRenderProps => {
        const {
          handleSubmit,
          values,
          form,
        } = fieldRenderProps;

        const onChange = (event) => {
          const currentMaxConsultations = event.values[FormValues.MaxConsultations];
          if (
            currentMaxConsultations !== prevTypeValue.current
          ) {
            prevTypeValue.current = event.values[FormValues.MaxConsultations];

            if (currentMaxConsultations === EnumMaximumConsultationsType.unlimited) {
              form.change('Limitations', undefined);
            }
          }
        };

        const { MaxConsultations: type, LimitTypes: limitations = [] } = values;

        // todo: reset value on checkbox untick
        return (
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSubmit(e);
            }}
          >
            <FormSpy onChange={onChange} />
            <FieldRadioButton
              id="max-consultations-disable"
              name={FormValues.MaxConsultations}
              label="Accept all"
              value={EnumMaximumConsultationsType.unlimited}
              showAsRequired
            />
            <FieldRadioButton
              id="max-consultations-enable"
              name={FormValues.MaxConsultations}
              label="Accept specific"
              value={EnumMaximumConsultationsType.limited}
              showAsRequired
            />

            <div className={classNames(css.panel, {
              [css.disabled]: type !== EnumMaximumConsultationsType.limited
            })}>
              <div className={css.formRow}>
                <FieldCheckbox
                  id="hours-per-day"
                  name={FormValues.LimitTypes}
                  label="Max hours per day"
                  value={getCheckboxId(EnumMaxNumberType.hoursPerDay)}
                />
                <FieldTextInput
                  type="number"
                  step="1"
                  id='hours-per-day-value'
                  name={`Limitations.${EnumMaxNumberType.hoursPerDay}`}
                  disabled={!limitations.includes(getCheckboxId(EnumMaxNumberType.hoursPerDay))}
                />
              </div>
              {/* todo: work on validations of limited, but no checkbox */}
              <div className={css.formRow}>
                <FieldCheckbox
                  id="number-per-day"
                  name={FormValues.LimitTypes}
                  label="Max number per day"
                  value={getCheckboxId(EnumMaxNumberType.numberPerDay)}
                />
                <FieldTextInput
                  type="number"
                  id="number-per-day-value"
                  name={`Limitations.${EnumMaxNumberType.numberPerDay}`}
                  disabled={!limitations.includes(getCheckboxId(EnumMaxNumberType.numberPerDay))}
                />
              </div>
              <div className={css.formRow}>
                <FieldCheckbox
                  id="number-per-week"
                  name={FormValues.LimitTypes}
                  label="Max number per week"
                  value={getCheckboxId(EnumMaxNumberType.numberPerWeek)}
                />
                <FieldTextInput
                  type="number"
                  id="number-per-week-value"
                  name={`Limitations.${EnumMaxNumberType.numberPerWeek}`}
                  disabled={!limitations.includes(getCheckboxId(EnumMaxNumberType.numberPerWeek))}
                />
              </div>
            </div>

            <Button style={{ marginTop: 24 }} type="submit" disabled={false}>
              Save limitations
            </Button>
          </form>
        );
      }}
    />
  );
}

export default MaximumConsultationAvailableForm;
