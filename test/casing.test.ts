import { describe, it, expect } from 'vitest';
import {
  splitWords,
  camel,
  pascal,
  kebab,
  snake,
  constant,
  title,
  lower,
  upper,
  plural,
  CASE_MODIFIERS
} from '../src/casing.js';

describe('splitWords', () => {
  it.each([
    ['userProfile', ['user', 'profile']],
    ['UserProfile', ['user', 'profile']],
    ['user-profile', ['user', 'profile']],
    ['user_profile', ['user', 'profile']],
    ['user profile', ['user', 'profile']],
    ['  User  Profile ', ['user', 'profile']],
    ['HTTPServer', ['http', 'server']],
    ['getHTTPResponse2', ['get', 'http', 'response2']],
    ['USER_ID', ['user', 'id']],
    ['', []]
  ])('%j', (input, expected) => {
    expect(splitWords(input)).toEqual(expected);
  });
});

describe('case conversions', () => {
  it.each([
    [pascal, 'user-profile', 'UserProfile'],
    [camel, 'user-profile', 'userProfile'],
    [kebab, 'UserProfile', 'user-profile'],
    [snake, 'UserProfile', 'user_profile'],
    [constant, 'userProfile', 'USER_PROFILE'],
    [title, 'user_profile', 'User Profile'],
    [lower, 'AbC', 'abc'],
    [upper, 'AbC', 'ABC'],
    [pascal, 'HTTPServer', 'HttpServer'],
    [camel, '', '']
  ])('%o(%j)', (fn, input, expected) => {
    expect(fn(input)).toBe(expected);
  });
});

describe('plural', () => {
  it.each([
    ['category', 'categories'],
    ['Category', 'Categories'],
    ['CATEGORY', 'CATEGORIES'],
    ['day', 'days'],
    ['box', 'boxes'],
    ['bus', 'buses'],
    ['match', 'matches'],
    ['dish', 'dishes'],
    ['buzz', 'buzzes'],
    ['user', 'users'],
    ['UserProfile', 'UserProfiles'],
    ['', '']
  ])('%j -> %j', (input, expected) => {
    expect(plural(input)).toBe(expected);
  });
});

describe('CASE_MODIFIERS', () => {
  it('lists every modifier', () => {
    expect([...CASE_MODIFIERS].sort()).toEqual(
      [
        'camel',
        'constant',
        'kebab',
        'lower',
        'pascal',
        'plural',
        'snake',
        'title',
        'upper'
      ].sort()
    );
  });
});
