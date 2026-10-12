"use client";

import { useState } from "react";
import { formatPhone, isValidName, isValidPhone } from "@/lib/booking";

type StepContactsProps = {
  name: string;
  phone: string;
  forceErrors: boolean;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
};

const inputClass = (hasError: boolean) =>
  `mt-3 h-14 w-full border bg-graphite-2 px-4 text-base text-bone placeholder:text-ash/60 transition-colors duration-200 outline-none focus:border-tungsten disabled:opacity-60 ${
    hasError ? "border-red-400/70" : "border-bone/15 hover:border-bone/30"
  }`;

export function StepContacts({
  name,
  phone,
  forceErrors,
  disabled,
  onNameChange,
  onPhoneChange,
}: StepContactsProps) {
  const [touched, setTouched] = useState({ name: false, phone: false });

  const nameError = (touched.name || forceErrors) && !isValidName(name);
  const phoneError = (touched.phone || forceErrors) && !isValidPhone(phone);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label htmlFor="booking-name" className="text-sm text-ash">
          Имя
        </label>
        <input
          id="booking-name"
          type="text"
          autoComplete="given-name"
          placeholder="Как к вам обращаться"
          value={name}
          disabled={disabled}
          aria-invalid={nameError}
          aria-describedby={nameError ? "booking-name-error" : undefined}
          onChange={(event) => onNameChange(event.target.value)}
          onBlur={() => setTouched((value) => ({ ...value, name: true }))}
          className={inputClass(nameError)}
        />
        {nameError && (
          <p id="booking-name-error" className="mt-2 text-sm text-red-300">
            Введите имя, минимум 2 буквы
          </p>
        )}
      </div>

      <div>
        <label htmlFor="booking-phone" className="text-sm text-ash">
          Телефон
        </label>
        <input
          id="booking-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+998 90 123-45-67"
          value={phone}
          disabled={disabled}
          aria-invalid={phoneError}
          aria-describedby={phoneError ? "booking-phone-error" : "booking-phone-hint"}
          onChange={(event) => onPhoneChange(formatPhone(event.target.value))}
          onBlur={() => setTouched((value) => ({ ...value, phone: true }))}
          className={`${inputClass(phoneError)} tabular-nums`}
        />
        {phoneError ? (
          <p id="booking-phone-error" className="mt-2 text-sm text-red-300">
            Нужен номер из 9 цифр после +998
          </p>
        ) : (
          <p id="booking-phone-hint" className="mt-2 text-sm text-ash">
            Позвоним, только если что-то изменится
          </p>
        )}
      </div>
    </div>
  );
}
