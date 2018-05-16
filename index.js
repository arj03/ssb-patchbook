const flumeView = require('flumeview-reduce')
const flattenDeep = require('lodash/flattenDeep')

var view;

// contains hydrated books and events
// events are of type: book, update, comment

module.exports = {
  name: 'patchbook',
  version: '1.0.0',
  manifest: {
    get: 'async',
    stream: 'source'
  },
  init: function (ssbServer, config) {
    view = ssbServer._flumeUse('patchbook', flumeView(
      21, // version
      reduce,
      map,
      null, //codec
      initialState()
    ))

    return {
      get: view.get,
      stream: view.stream
    }
  }
}

function reduce(result, msg) {
  if (!msg) return result

  const { author, content } = msg.value

  if (content.type == 'bookclub') {
    var book = {
      key: msg.key,
      common: content,
      subjective: {}
    }

    result.books[msg.key] = book
    result.events.push({ type: 'book', author, content })
  }
  else if (content.type == 'post')
  {
    Object.values(view.value.value.books).forEach(book => {
      Object.values(book.subjective).forEach(s => {
        if (content.root in s.allKeys) {
          s.comments.push(content)
        }
      })
    })

    result.events.push({ type: 'comment', author, content })
  }
  else // about
  {
    const { rating, ratingMax, ratingType, shelve, genre, review } = content

    let book = view.value.value.books[content.about]

    let allKeys = (book.subjective[author] || { allKeys: [] }).allKeys
    allKeys.push(msg.key)

    if (rating || ratingMax || ratingType || shelve || genre || review) {
      book.subjective[author] = {
        key: msg.key,
        allKeys,
        rating,
        ratingMax,
        ratingType,
        shelve,
        genre,
        review,
        comments: []
      }

      updateSubjectives(view.value.value.books)

    } else
      book.common = Object.assign({}, book.common, content)

    result.books[content.about] = book
    result.events.push({ type: 'update', author, content })
  }

  return result
}

var subjectives = []

function updateSubjectives(books)
{
  subjectives = flattenDeep(Object.values(Object.values(books).map(b => b.subjective)).map(s => Object.values(s).map(s2 => s2.allKeys)))
}

function map(msg) {
  if (!msg.value.content) return

  const { type, about, root } = msg.value.content

  if (!subjectives) updateSubjectives(view.value.value.books)

  // FIXME: things are not streamed in the correct order
  
  if (type == 'bookclub')
    return msg
  else if (type == 'post' && subjectives.includes(root))
    return msg
  else if (type == 'about' && about in view.value.value.books)
    return msg
//  else if (type == 'bookclub-update')
//    return msg
}

function initialState () {
  return { books: {}, events: [] }
}
