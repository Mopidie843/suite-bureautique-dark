package fr.nocte.suite;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NoctePrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
