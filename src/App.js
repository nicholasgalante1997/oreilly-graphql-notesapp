import React from 'react';
import logo from './logo.svg';
import './App.css';
// React Hooks
import {useEffect, useReducer} from 'react'
// This is the graphQL client that we will be using to interact with the AppSync endpoint (think fetch or axios)
import { API } from 'aws-amplify'
// UI Component from the AntD Library 
import { List, Input, Button } from 'antd'
import 'antd/dist/antd.css'
// the graphQL query operation for fetching an array of notes
import { listNotes } from './graphql/queries'
// UUID Library
import { v4 as uuid } from 'uuid'
// GRAPHQL MUTATIONS
import { createNote as CreateNote, deleteNote as DeleteNote, updateNote as UpdateNote } from './graphql/mutations'
// graphQL subscriptions
import { onCreateNote } from './graphql/subscriptions'

const CLIENT_ID = uuid()

const initialState = {
  notes: [],
  loading: true,
  error: false,
  form: {
    name: '',
    description: ''
  }
}

// styles for the listing components
const styles = {
  container: {padding: 20},
  input: {marginBottom: 10},
  item: {textAlign: 'left'},
  p: {color: '#1890ff'}
}

// React Hooks for State Management
function reducer(state, action) {
  switch (action.type) {
    case 'SET_NOTES':
      return {...state,  notes: action.notes, loading: false}
    case 'ERROR':
      return {...state, loading: false, error: true}
    case 'ADD_NOTE':
      return {...state, notes: [action.note, ...state.notes]}
    case 'RESET_FORM':
      return {...state, form: initialState.form }
    case 'SET_INPUT':
      return {...state, form: {...state.form, [action.name]: action.value }}
    default:
      return state;
  }
}

function App() {
  // update App to create the state and dispatch variables by calling useReducer and passing it 
  // the previously defined reducer and initialState
  const [state, dispatch] = useReducer(reducer, initialState)

  // to fetch the notes, create a fetchNotes function that will call the AppSync Api
  // and set the notes array to state when the call is successful:
  async function fetchNotes(){
    try {
      const notesData = await API.graphql({
        query: listNotes 
      })
      dispatch({ type: 'SET_NOTES', notes: notesData.data.listNotes.items })
    } catch (err) {
      console.log('error: ', err)
      dispatch({ type: 'ERROR' })
    }
  }

  async function createNote(){
    const { form } = state

    if (!form.name || !form.description ) {
      return alert('please enter a name and a description.')
    }
    const note = { ...form, clientId: CLIENT_ID, completed: false, id: uuid() }
    dispatch({ type: 'ADD_NOTE', note })
    dispatch({type: 'RESET_FORM'})
    try {
      await API.graphql({
        query: CreateNote,
        variables: { input: note }
      })
      console.log('successfully created note!')
    } catch (err) {
      console.log('error: ', err )
    }
  }

  async function deleteNote({ id }){
    const index = state.notes.findIndex(n => n.id === id )
    const notes = [
      ...state.notes.slice(0, index),
      ...state.notes.slice(index + 1)
    ]
    dispatch({ type: 'SET_NOTES', notes })
    try {
      await API.graphql({
        query: DeleteNote,
        variables: { input: { id }}
      })
      console.log('successfully deleted note.')
    } catch (err) {
      console.log({err})
    }
  }

  async function updateNote(note){
    const index = state.notes.findIndex(n => n.id === note.id )
    const notes = [...state.notes]
    notes[index].completed = !note.completed
    dispatch({ type: 'SET_NOTES', notes })
    try {
      await API.graphql({
        query: UpdateNote,
        variables: { input: { id: note.id, completed: notes[index].completed }}
      })
      console.log('updated successfully.')
    } catch (err) {
      console.log('error: ', err)
    }
  }

  // alternative change handler for React Hook State as opposed to Redux or Local State
  function onChange(e){
    dispatch({ type: 'SET_INPUT', name: e.target.name, value: e.target.value })
  }

  useEffect(() => {
    fetchNotes()
    const subscription = API.graphql({
      query: onCreateNote
    })
    .subscribe({
      next: noteData => {
        const note = noteData.value.data.onCreateNote
        if (CLIENT_ID === note.cliendId) return 
        dispatch({ type: 'ADD_NOTE', note })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  function renderItem(item) {
    return (
      <List.Item 
      style={styles.item}
      actions={[<p style={styles.p} onClick={() => deleteNote(item)}>Delete</p>,
                <p style={styles.p} onClick={() => updateNote(item)}>
                  {item.completed ? 'completed' : 'mark completed'}
                </p>]}>
        <List.Item.Meta 
          title={item.name}
          description={item.description}
          />
      </List.Item>
    )
  }

  return (
    <div style={styles.container}>
      <Input
        onChange={onChange}
        value={state.form.name}
        placeholder='note name'
        name='name'
        style={styles.input}
        />
      <Input 
        onChange={onChange}
        value={state.form.description}
        placeholder='note desc'
        name='description'
        style={styles.input}
        />
      <Button onClick={createNote} type='primary'>
        Create Note
      </Button>
      <List 
        loading={state.loading}
        dataSource={state.notes}
        renderItem={renderItem}
      />
    </div>
  );
}

export default App;
