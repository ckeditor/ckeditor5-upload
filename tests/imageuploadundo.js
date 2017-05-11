/**
 * @license Copyright (c) 2003-2017, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* globals window */

import ClassicTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import ImageEngine from '@ckeditor/ckeditor5-image/src/image/imageengine';
import ImageUploadEngine from '../src/imageuploadengine';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import FileRepository from '../src/filerepository';
import { AdapterMock, createNativeFileMock, NativeFileReaderMock } from './_utils/mocks';
import { setData as setModelData, getData as getModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';
import Notification from '@ckeditor/ckeditor5-ui/src/notification/notification';
import UndoEngine from '@ckeditor/ckeditor5-undo/src/undoengine';
import Typing from '@ckeditor/ckeditor5-typing/src/typing';

describe.only( 'Image upload undo integration', () => {
	let editor, document, fileRepository, viewDocument, nativeReaderMock, loader, adapterMock, notification,
		undoCommand, redoCommand;
	testUtils.createSinonSandbox();

	beforeEach( () => {
		testUtils.sinon.stub( window, 'FileReader', () => {
			nativeReaderMock = new NativeFileReaderMock();

			return nativeReaderMock;
		} );

		return ClassicTestEditor.create( {
			plugins: [ ImageEngine, ImageUploadEngine, Paragraph, UndoEngine, Typing ]
		} )
			.then( newEditor => {
				editor = newEditor;
				document = editor.document;
				viewDocument = editor.editing.view;

				fileRepository = editor.plugins.get( FileRepository );
				fileRepository.createAdapter = newLoader => {
					loader = newLoader;
					adapterMock = new AdapterMock( loader );

					return adapterMock;
				};

				notification = editor.plugins.get( Notification );
				notification.on( 'show:warning', ( evt ) => {
					evt.stop();
				}, { priority: 'high' } );

				undoCommand = editor.commands.get( 'undo' );
				redoCommand = editor.commands.get( 'redo' );
			} );
	} );

	it( 'should work correctly when upload error occurs', ( done ) => {
		const file = createNativeFileMock();
		setModelData( document, '<paragraph>{}foo bar</paragraph>' );
		editor.execute( 'imageUpload', { file } );
		let isRemoved = false;

		// Check if undo works properly after image is removed.
		document.on( 'change', ( evt, type ) => {
			if ( type == 'remove' && !isRemoved ) {
				isRemoved = true;

				expect( getModelData( document ) ).to.equal( '<paragraph>[]foo bar</paragraph>' );
				expect( undoCommand.isEnabled ).to.be.true;
				expect( redoCommand.isEnabled ).to.be.false;

				document.once( 'changesDone', () => {
					expect( undoCommand.isEnabled ).to.be.false;
					expect( redoCommand.isEnabled ).to.be.true;
					expect( getModelData( document ) ).to.equal( '<paragraph>[]foo bar</paragraph>' );

					done();
				} );

				editor.execute( 'undo' );
			}
		} );

		nativeReaderMock.mockError( 'Upload error.' );
	} );

	it( 'should work correctly when image is removed during upload', ( done ) => {
		const file = createNativeFileMock();
		setModelData( document, '<paragraph>{}foo bar</paragraph>' );
		editor.execute( 'imageUpload', { file } );
		editor.execute( 'delete' );

		setTimeout( () => {
			expect( getModelData( document ) ).to.equal( '<paragraph>[]</paragraph><paragraph>foo bar</paragraph>' );
			expect( undoCommand.isEnabled ).to.be.true;

			editor.execute( 'undo' );

			expect( getModelData( document ) ).to.equal( '<paragraph>[]</paragraph><paragraph>foo bar</paragraph>' );

			done();
		}, 1 );
	} );

	it( 'should work correctly when undo is executed during upload', ( done ) => {
		const file = createNativeFileMock();
		setModelData( document, '<paragraph>{}foo bar</paragraph>' );
		editor.execute( 'imageUpload', { file } );

		setTimeout( () => {
			editor.execute( 'undo' );

			setTimeout( () => {
				expect( getModelData( document ) ).to.equal( '<paragraph>[]foo bar</paragraph>' );

				editor.execute( 'redo' );
				expect( getModelData( document ) ).to.equal( '<paragraph>[]foo bar</paragraph>' );

				done();
			}, 100 );
		}, 100 );

	} );
} );
